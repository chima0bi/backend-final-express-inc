import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import { validateReview } from "../authMiddleWare/validation.js";
import {
  createReview,
  getListingReviews,
  getProviderReviews,
  respondToReview,
  deleteReview,
} from "../controller/review_ctr.js";

const router = express.Router();

router.post("/", authenticate, allowRoles("user"), validateReview, createReview);
router.get("/listing/:listingId", getListingReviews);
router.get("/provider/:providerId", getProviderReviews);
router.patch("/:id/respond", authenticate, allowRoles("provider"), respondToReview);
router.delete("/:id", authenticate, allowRoles("admin", "owner"), deleteReview);

export default router;
