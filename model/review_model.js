import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true, // one review per booking
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
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProviderListing",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },

    providerResponse: { type: String, trim: true, maxlength: 1000 },
    respondedAt: { type: Date },
  },
  { timestamps: true },
);

reviewSchema.index({ provider: 1, createdAt: -1 });
reviewSchema.index({ listing: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);
export default Review;
