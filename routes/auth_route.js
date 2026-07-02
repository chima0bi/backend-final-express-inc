import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import { refresh, logout, getActiveSessions } from "../controller/auth_ctr.js";

const router = express.Router();

// Called automatically by the frontend's axios interceptor when an access
// token expires - the user never sees this happen. Uses the httpOnly
// refresh token cookie, never a request body param.
router.post("/refresh", refresh);

// Secure logout: deletes the session server-side so a stolen cookie
// can't be replayed after logout.
router.post("/logout", logout);

// OWNER only: scrolling list of active sessions and user counts.
// Read-only - no revoke capability per spec.
router.get("/sessions", authenticate, allowRoles("owner"), getActiveSessions);

export default router;
