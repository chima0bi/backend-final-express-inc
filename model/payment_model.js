import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
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
    amount: { type: Number, required: true, min: 0 }, // in Naira (we convert to kobo only when calling Paystack)
    platformFee: { type: Number, required: true, default: 0 },
    providerPayout: { type: Number, required: true, default: 0 },

    paystackReference: { type: String, required: true, unique: true },
    paystackAccessCode: { type: String },

    status: {
      type: String,
      enum: [
        "pending", // initialized, awaiting customer to pay
        "paid", // Paystack confirmed payment - funds held in escrow
        "released", // booking completed, payout released to provider
        "refunded", // booking cancelled, refunded to customer
        "failed",
      ],
      default: "pending",
    },

    paidAt: { type: Date },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true },
);

// paymentSchema.index({ paystackReference: 1 });
paymentSchema.index({ status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
