import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProviderListing",
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, maxlength: 1000 },
    address: { type: String, required: true, trim: true },

    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true }, // "14:30" - kept simple

    status: {
      type: String,
      enum: [
        "pending", // just created, awaiting provider response
        "accepted", // provider accepted
        "declined", // provider declined
        "in-progress", // provider has started the job
        "completed", // job done, triggers payout release
        "cancelled", // cancelled by customer or admin
      ],
      default: "pending",
    },

    cancelledBy: { type: String, enum: ["customer", "provider", "admin"] },
    cancellationReason: { type: String, trim: true },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },

    isReviewed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ provider: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
