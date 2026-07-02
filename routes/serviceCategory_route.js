import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import { validateCategory } from "../authMiddleWare/validation.js";
import {
  createCategory,
  updateCategory,
  getAllCategories,
  getCategoryById,
  deleteCategory,
} from "../controller/serviceCategory_ctr.js";

const router = express.Router();

// Public - powers the service dropdown on Register.jsx and category filters
router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

// Admin only
router.post("/", authenticate, allowRoles("admin", "owner"), validateCategory, createCategory);
router.put("/:id", authenticate, allowRoles("admin", "owner"), updateCategory);
router.delete("/:id", authenticate, allowRoles("admin", "owner"), deleteCategory);

export default router;
