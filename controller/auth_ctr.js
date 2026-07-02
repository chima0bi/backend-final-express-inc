import bcrypt from "bcryptjs";
import User from "../model/user_model.js";
import Session from "../model/session_model.js";
import {
  signAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_COOKIE,
  refreshCookieOptions,
} from "../utils/token.js";
import { sanitizeUser } from "../utils/token.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const MAX_LOGIN_ATTEMPTS = 7;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_FAILURE = "Invalid login. Please check your details and try again.";

// Best-effort IP geolocation via ip-api.com - free, no API key required,
// 45 req/min limit (well within any realistic login rate). Called at login
// time only, never on every request. Times out after 3 seconds so a slow
// response never blocks the login response itself - location is informational
// only, not security-critical.
const getLocationFromIp = async (ip) => {
  try {
    // Skip private/loopback IPs (localhost dev, internal networks)
    if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return "Local network";
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,status`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.status === "success") {
      return [data.city, data.country].filter(Boolean).join(", ");
    }
  } catch {
    // Timeout or network error - not worth logging, location is optional
  }
  return null;
};

// Parse a readable device description from the User-Agent string.
// No third-party parser needed - the patterns below cover the vast majority
// of real-world user agents (Chrome/Firefox/Safari/Edge on Windows/Mac/
// iOS/Android) without adding a dependency.
const parseDeviceInfo = (userAgent = "") => {
  const ua = userAgent;
  let browser = "Unknown browser";
  let os = "Unknown OS";

  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} on ${os}`;
};

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user) {
    return res.status(401).json({ message: GENERIC_LOGIN_FAILURE });
  }

  if (user.lockUntil && user.lockUntil > Date.now()) {
    return res.status(423).json({
      message: "This account is temporarily locked due to repeated failed attempts. Please try again later.",
    });
  }

  const correctPassword = await bcrypt.compare(password, user.password);
  if (!correctPassword) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.loginAttempts = 0;
    }
    await user.save();
    return res.status(401).json({ message: GENERIC_LOGIN_FAILURE });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: "This account has been suspended. Contact support." });
  }

  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLogin = new Date();
  await user.save();

  // Single-session enforcement: delete any existing session for this user
  // so logging in on a new device automatically logs out the old one.
  await Session.deleteMany({ user: user._id });

  // Gather device/location info for the session record. Both are
  // best-effort and never block the login response.
  const ip = req.ip || req.socket?.remoteAddress;
  const deviceInfo = parseDeviceInfo(req.headers["user-agent"]);
  const location = await getLocationFromIp(ip);

  // Generate the refresh token and store only its hash in the DB
  const { raw: rawRefreshToken, hashed: refreshTokenHash } = generateRefreshToken();

  await Session.create({
    user: user._id,
    refreshTokenHash,
    ipAddress: ip,
    deviceInfo,
    location,
  });

  const accessToken = signAccessToken(user);

  // Refresh token goes in an httpOnly cookie - JS can't read it, which
  // means XSS attacks can't steal it, unlike a token stored in localStorage.
  res.cookie(REFRESH_TOKEN_COOKIE, rawRefreshToken, refreshCookieOptions());

  return res.status(200).json({
    message: "Login successful",
    accessToken,
    user: sanitizeUser(user),
  });
});

// Silent token refresh. Called by the frontend's axios interceptor when
// any request gets a 401 TOKEN_EXPIRED response - the user never sees a
// login page mid-session, the request just retries with a fresh access token.
export const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (!rawRefreshToken) {
    return res.status(401).json({ message: "No refresh token", code: "NO_REFRESH_TOKEN" });
  }

  const tokenHash = Session.hashToken(rawRefreshToken);
  const session = await Session.findOne({ refreshTokenHash: tokenHash }).populate("user");

  if (!session || !session.user) {
    // Token not found = already logged out or stolen/invalid
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/auth" });
    return res.status(401).json({ message: "Session not found. Please log in again.", code: "SESSION_NOT_FOUND" });
  }

  if (session.expiresAt < new Date()) {
    await session.deleteOne();
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/auth" });
    return res.status(401).json({ message: "Session expired. Please log in again.", code: "SESSION_EXPIRED" });
  }

  if (!session.user.isActive) {
    await session.deleteOne();
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/auth" });
    return res.status(403).json({ message: "Account suspended.", code: "SUSPENDED" });
  }

  // Rotate the refresh token on every use (refresh token rotation) -
  // if a stolen token is used, the legitimate user's next refresh will
  // fail and they'll know something is wrong. The old hash is replaced
  // with the new one in the same session doc.
  const { raw: newRawToken, hashed: newHash } = generateRefreshToken();
  session.refreshTokenHash = newHash;
  session.lastUsedAt = new Date();
  await session.save();

  res.cookie(REFRESH_TOKEN_COOKIE, newRawToken, refreshCookieOptions());

  const accessToken = signAccessToken(session.user);
  return res.status(200).json({ accessToken, user: sanitizeUser(session.user) });
});

// Secure logout: deletes the session server-side so the refresh token
// can never be used again even if someone has a copy of the cookie.
// Just clearing the cookie on the client is NOT enough - the hash in
// the DB needs to go too.
export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (rawRefreshToken) {
    const tokenHash = Session.hashToken(rawRefreshToken);
    await Session.deleteOne({ refreshTokenHash: tokenHash });
  }

  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/auth" });
  return res.status(200).json({ message: "Logged out successfully" });
});

// OWNER only: list of active sessions with device/location info.
// No "revoke" button per spec - this is a read-only analytics view.
export const getActiveSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ expiresAt: { $gt: new Date() } })
    .populate("user", "name email role")
    .sort({ lastUsedAt: -1 });

  const totalUsers = await (await import("../model/user_model.js")).default.countDocuments({ role: "user", isActive: true });
  const totalProviders = await (await import("../model/user_model.js")).default.countDocuments({ role: "provider", isActive: true });

  return res.status(200).json({
    message: "Active sessions retrieved",
    activeSessions: sessions.length,
    totalActiveUsers: totalUsers,
    totalActiveProviders: totalProviders,
    sessions: sessions.map((s) => ({
      user: s.user,
      deviceInfo: s.deviceInfo,
      location: s.location,
      ipAddress: s.ipAddress,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
    })),
  });
});
