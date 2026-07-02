import mongoose from "mongoose";
import crypto from "crypto";

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The refresh token is stored hashed (SHA-256), not plaintext, so
    // a database leak doesn't expose working tokens. The plaintext version
    // is only ever held in memory during the login response and in the
    // user's httpOnly cookie - it never touches the DB in raw form.
    refreshTokenHash: { type: String, required: true },
    ipAddress: { type: String },
    deviceInfo: { type: String },   // e.g. "Chrome on Windows"
    location: { type: String },     // e.g. "Lagos, Nigeria" from ip-api.com
    lastUsedAt: { type: Date, default: Date.now },
    // TTL index: MongoDB automatically deletes session docs 3 days after
    // createdAt, matching the refresh token's validity window, so orphaned
    // sessions can never accumulate indefinitely even if explicit logout
    // is somehow skipped.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      index: { expires: 0 }, // TTL index
    },
  },
  { timestamps: true },
);

sessionSchema.index({ user: 1 }); // fast lookup for "delete previous session on new login"

// Convenience: hash a raw refresh token the same way every time
sessionSchema.statics.hashToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

const Session = mongoose.model("Session", sessionSchema);
export default Session;
