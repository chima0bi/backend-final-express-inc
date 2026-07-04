// import dns from "dns";
// dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";

import authRoute from "./routes/auth_route.js";
import userRoute from "./routes/user_route.js";
import serviceCategoryRoute from "./routes/serviceCategory_route.js";
import categoryRequestRoute from "./routes/categoryRequest_route.js";
import providerListingRoute from "./routes/providerListing_route.js";
import bookingRoute from "./routes/booking_route.js";
import reviewRoute from "./routes/review_route.js";
import paymentRoute from "./routes/payment_route.js";
import payoutRoute from "./routes/payout_route.js";
import adminRoute from "./routes/admin_route.js";
import complaintRoute from "./routes/complaint_route.js";
import User from "./model/user_model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("trust proxy", 1);

// ── CORS ────────────────────────────────────────────────────────────────
const AllowedOrigins = [
  process.env.ORIGIN_LOCAL,
  process.env.ORIGIN_VERCEL,
  process.env.ORIGIN_RENDER,
  process.env.ORIGIN_HOSTED_FRONTEND,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // mobile apps, curl, postman
    if (AllowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(cookieParser()); // needed to read the httpOnly refresh token cookie
// Express 5 + path-to-regexp v6 rejects a bare "*" or regex wildcard here;
// applying cors() globally above already answers OPTIONS preflight requests
// correctly for every route, so a separate app.options() catch-all is both
// unnecessary and was the source of the original crash/bug.

// ── Paystack webhook needs the RAW body for signature verification,
// so it must be registered BEFORE express.json() and only for that path.
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body;
    req.body = JSON.parse(req.body.toString("utf8"));
    next();
  },
);

app.use(express.json());

// ── Rate limiting (applied once) ───────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// ── Static file serving for uploaded service media ─────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/categories", serviceCategoryRoute);
app.use("/api/category-requests", categoryRequestRoute);
app.use("/api/listings", providerListingRoute);
app.use("/api/bookings", bookingRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/payments", paymentRoute);
app.use("/api/payouts", payoutRoute);
app.use("/api/admin", adminRoute);
app.use("/api/complaints", complaintRoute);

app.get("/", (req, res) => {
  res.send("You have reached the backend for Express.Inc 🚀");
});

// 404 handler for unmatched API routes
app.use("/api", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ── Centralized error handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Not allowed by CORS" });
  }
  if (err.name === "ValidationError") {
    return res
      .status(400)
      .json({ message: "Validation error", details: err.message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return res
      .status(409)
      .json({ message: `${field || "Field"} already in use` });
  }
  if (err.message?.includes("Only") || err.message?.includes("not allowed")) {
    return res.status(400).json({ message: err.message }); // multer file-type errors
  }

  return res.status(500).json({ message: "Server error", error: err.message });
});

// ── Start ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await User.syncIndexes();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    // console.log("CORS allowed origins:", AllowedOrigins);
  });
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});
