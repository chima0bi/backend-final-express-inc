import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import { validateBooking } from "../authMiddleWare/validation.js";
import {
  createBooking,
  updateBookingStatus,
  getMyBookingsAsCustomer,
  getMyBookingsAsProvider,
  getAllBookings,
  getBookingById,
  deleteBooking,
  getProviderEarningsTrend,
  getProviderBookingFunnel,
  getProviderListingPerformance,
  getCustomerSpendingTrend,
  getCustomerCategoryBreakdown,
} from "../controller/booking_ctr.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  allowRoles("user", "provider"),
  validateBooking,
  createBooking,
);

router.get(
  "/mine/customer",
  authenticate,
  allowRoles("user"),
  getMyBookingsAsCustomer,
);
router.get(
  "/mine/provider",
  authenticate,
  allowRoles("provider"),
  getMyBookingsAsProvider,
);
router.get("/", authenticate, allowRoles("admin", "owner"), getAllBookings);

// Analytics routes must be registered before /:id — otherwise Express
// treats the literal string "analytics" as a booking id and 404s.
router.get(
  "/analytics/provider/earnings",
  authenticate,
  allowRoles("provider"),
  getProviderEarningsTrend,
);
router.get(
  "/analytics/provider/funnel",
  authenticate,
  allowRoles("provider"),
  getProviderBookingFunnel,
);
router.get(
  "/analytics/provider/listings",
  authenticate,
  allowRoles("provider"),
  getProviderListingPerformance,
);
router.get(
  "/analytics/customer/spending",
  authenticate,
  allowRoles("user"),
  getCustomerSpendingTrend,
);
router.get(
  "/analytics/customer/categories",
  authenticate,
  allowRoles("user"),
  getCustomerCategoryBreakdown,
);

router.get("/:id", authenticate, getBookingById);
router.patch("/:id/status", authenticate, updateBookingStatus);
router.delete(
  "/:id",
  authenticate,
  allowRoles("admin", "owner"),
  deleteBooking,
);

export default router;
