import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import { validateCategoryRequest, validateCategoryReview } from "../authMiddleWare/validation.js";
import {
  createCategoryRequest,
  getMyCategoryRequests,
  getAllCategoryRequests,
  reviewCategoryRequest,
} from "../controller/categoryRequest_ctr.js";

const router = express.Router();

router.post("/", authenticate, allowRoles("provider"), validateCategoryRequest, createCategoryRequest);
router.get("/mine", authenticate, allowRoles("provider"), getMyCategoryRequests);
router.get("/", authenticate, allowRoles("admin", "owner"), getAllCategoryRequests);
router.patch("/:id/review", authenticate, allowRoles("admin", "owner"), validateCategoryReview, reviewCategoryRequest);

export default router;
