import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 3;

// Short-lived access token (15 minutes). Proves "this request is
// authenticated right now." Sent in Authorization: Bearer header on every
// API call. If stolen, it stops working on its own within 15 minutes -
// unlike the old 3-hour single token, which gave an attacker much more time.
export const signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.SECRET_KEY,
    { expiresIn: ACCESS_TOKEN_TTL },
  );

// Long-lived refresh token (3 days). NOT a JWT - just a cryptographically
// random string. Sent in an httpOnly cookie (JavaScript can never read it,
// only the browser sends it automatically). Used only at /api/auth/refresh
// to silently get a new access token. Stored hashed in the Session doc.
export const generateRefreshToken = () => ({
  raw: crypto.randomBytes(40).toString("hex"), // what goes in the cookie
  get hashed() {
    return crypto.createHash("sha256").update(this.raw).digest("hex");
  },
});

export const REFRESH_TOKEN_COOKIE = "rt";

export const refreshCookieOptions = (rememberMe = true) => ({
  httpOnly: true,     // JS cannot read this cookie - the main security gain
  secure: true, // process.env.NODE_ENV === "production", // HTTPS only in prod
  sameSite: "none", // not sent on cross-site requests (CSRF protection)
  maxAge: rememberMe ? REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 : undefined,
  path: "/api/auth",  // cookie only sent to the refresh endpoint, not every request
});

// Keep backward compat for any places that still call signToken
// (e.g. seed script) - alias to the new access token signer.
export const signToken = signAccessToken;

export const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  return obj;
};
