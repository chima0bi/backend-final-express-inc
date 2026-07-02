import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import {
  getAdminStats,
  getRecentUsers,
  getRecentBookings,
  getPlatformGrowth,
  getRevenueTrend,
  getBookingFunnel,
  getTopCategories,
} from "../controller/admin_ctr.js";

const router = express.Router();

router.use(authenticate, allowRoles("admin", "owner"));

router.get("/stats", getAdminStats);
router.get("/recent-users", getRecentUsers);
router.get("/recent-bookings", getRecentBookings);

router.get("/analytics/growth", getPlatformGrowth);
router.get("/analytics/revenue", getRevenueTrend);
router.get("/analytics/booking-funnel", getBookingFunnel);
router.get("/analytics/top-categories", getTopCategories);

export default router;
