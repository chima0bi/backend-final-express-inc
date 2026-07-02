import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import {
  initializePayment,
  verifyPayment,
  paystackWebhook,
  releasePayout,
  getPaymentByBooking,
} from "../controller/payment_ctr.js";

const router = express.Router();

// Webhook must receive the raw body - handled by express.raw() in index.js
// for this specific path, mounted BEFORE express.json().
router.post("/webhook", paystackWebhook);

router.post("/initialize", authenticate, allowRoles("user", "provider"), initializePayment);
router.get("/verify/:reference", authenticate, verifyPayment);
router.get("/booking/:bookingId", authenticate, getPaymentByBooking);
router.post("/release/:bookingId", authenticate, allowRoles("admin", "owner"), releasePayout);

export default router;
