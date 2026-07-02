import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import {
  validateListing,
  validateListingUpdate,
  validateListingVerification,
} from "../authMiddleWare/validation.js";
import { uploadServiceMedia } from "../config/upload.js";
import {
  createListing,
  addListingMedia,
  removeListingMedia,
  updateListing,
  deleteListing,
  getAllListings,
  getFeaturedListings,
  getListingById,
  getMyListings,
  toggleFeatured,
  getPendingVerificationListings,
  reviewListingVerification,
} from "../controller/providerListing_ctr.js";

const router = express.Router();

const mediaFields = uploadServiceMedia.fields([
  { name: "images", maxCount: 6 },
  { name: "videos", maxCount: 2 },
]);

// Public - browsing. Literal-path GETs must be registered before the
// "/:id" catch-all below, otherwise Express would try to treat
// "featured"/"mine"/"pending-verification" themselves as a listing id.
router.get("/", getAllListings);
router.get("/featured", getFeaturedListings);
router.get("/mine/all", authenticate, allowRoles("provider"), getMyListings);
router.get(
  "/pending-verification",
  authenticate,
  allowRoles("admin", "owner"),
  getPendingVerificationListings,
);

// Provider - manage own listings (created from dashboard, after registration)
router.post("/", authenticate, allowRoles("provider"), mediaFields, validateListing, createListing);
router.put("/:id", authenticate, allowRoles("provider", "admin", "owner"), validateListingUpdate, updateListing);
router.delete("/:id", authenticate, allowRoles("provider", "admin", "owner"), deleteListing);
router.post("/:id/media", authenticate, allowRoles("provider", "admin", "owner"), mediaFields, addListingMedia);
router.delete("/:id/media", authenticate, allowRoles("provider", "admin", "owner"), removeListingMedia);

// Admin/owner
router.patch("/:id/feature", authenticate, allowRoles("admin", "owner"), toggleFeatured);
router.patch(
  "/:id/verify",
  authenticate,
  allowRoles("admin", "owner"),
  validateListingVerification,
  reviewListingVerification,
);

// Catch-all single listing lookup - registered LAST among GET routes so it
// never shadows a literal path declared above it.
router.get("/:id", getListingById);

export default router;
