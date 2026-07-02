import jwt from "jsonwebtoken";
import User from "../model/user_model.js";

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated, no token", code: "NO_TOKEN" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "This account has been suspended. Contact support.",
        code: "SUSPENDED",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    // Distinguish expired (can silently refresh) from invalid (must re-login).
    // The frontend's axios interceptor uses this `code` to decide whether
    // to attempt a /api/auth/refresh call or redirect to /login.
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Not authenticated, invalid token", code: "INVALID_TOKEN" });
  }
};

// Role gate - only allows the listed roles through
export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ message: "Access denied" });
  };
};

// Resource-ownership gate - lets the resource owner OR admin/owner through.
// `getOwnerId` pulls the owning user's id off whatever req has (params, or
// a doc already attached by a previous middleware like attachBooking).
export const allowSelfOrRoles = (getOwnerId, ...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const ownerId = getOwnerId(req);
    const isOwner = ownerId && String(ownerId) === String(req.user._id);
    const hasRole = roles.includes(req.user.role);

    if (isOwner || hasRole) {
      return next();
    }
    return res.status(403).json({ message: "Access denied" });
  };
};
