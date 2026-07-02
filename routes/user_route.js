import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import { validateRegistration, validateLogin, validateUpdate, validateAvailability } from "../authMiddleWare/validation.js";
import { uploadPortfolioItem } from "../config/upload.js";
import { login } from "../controller/auth_ctr.js";
import {
  createUser,
  getMe,
  getUserById,
  getAllUsers,
  updateUser,
  deleteUser,
  promoteToAdmin,
  demoteAdmin,
  suspendUser,
  unsuspendUser,
  getAllProviders,
  getProviderProfile,
  updateAvailability,
  addPortfolioItem,
  removePortfolioItem,
  toggleFavoriteProvider,
  getMyFavoriteProviders,
} from "../controller/user_ctr.js";

const router = express.Router();

// Public
router.post("/register", validateRegistration, createUser);
router.post("/login", validateLogin, login); // now handled by auth_ctr which creates a session
router.get("/providers", getAllProviders);
router.get("/providers/:id", getProviderProfile);

// Authenticated self-service
router.get("/me", authenticate, getMe);
router.put("/me", authenticate, validateUpdate, updateUser);
router.delete("/me", authenticate, deleteUser);

// Provider: own availability calendar + portfolio
router.put("/me/availability", authenticate, allowRoles("provider"), validateAvailability, updateAvailability);
router.post("/me/portfolio", authenticate, allowRoles("provider"), uploadPortfolioItem.single("file"), addPortfolioItem);
router.delete("/me/portfolio/:itemId", authenticate, allowRoles("provider"), removePortfolioItem);

// Customer: favorite providers
router.get("/me/favorites", authenticate, allowRoles("user"), getMyFavoriteProviders);
router.patch("/me/favorites/:providerId", authenticate, allowRoles("user"), toggleFavoriteProvider);

// Admin/owner management
router.get("/", authenticate, allowRoles("admin", "owner"), getAllUsers);
router.get("/:id", authenticate, allowRoles("admin", "owner"), getUserById);
router.put("/:id", authenticate, allowRoles("admin", "owner"), validateUpdate, updateUser);
router.delete("/:id", authenticate, allowRoles("admin", "owner"), deleteUser);
router.patch("/:id/promote", authenticate, allowRoles("owner"), promoteToAdmin);
router.patch("/:id/demote", authenticate, allowRoles("owner"), demoteAdmin);
router.patch("/:id/suspend", authenticate, allowRoles("admin", "owner"), suspendUser);
router.patch("/:id/unsuspend", authenticate, allowRoles("admin", "owner"), unsuspendUser);

export default router;
