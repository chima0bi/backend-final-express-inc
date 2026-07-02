import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      match: [/^\+?[0-9]{10,15}$/, "Please enter a valid phone number"],
    },
    password: { type: String, required: true, select: false },
    country: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    address: { type: String, required: false, trim: true },
    avatar: { type: String, default: "" },
    role: {
      type: String,
      required: true,
      enum: ["user", "provider", "admin", "owner"],
      default: "user",
    },

    // Provider-specific professional info (not their listings — those live in
    // the ProviderListing collection so a provider can have many of them).
    experienceYears: { type: Number, required: false, min: 0, max: 60 },
    bio: { type: String, maxlength: 1000 },

    // Provider availability calendar - dates the provider has already
    // marked as booked/unavailable. Viewable by anyone (customers deciding
    // whether to book, other providers) on the provider's public profile.
    // This lives on the provider's account, not per-listing, since a
    // provider only has so many hours in a day across all their services.
    unavailableDates: [{ type: Date }],

    // Provider portfolio - certificates and past-work photos/videos shown
    // on their public profile. Distinct from ProviderListing.images/videos,
    // which are specific to one listing.
    portfolio: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video", "certificate"], required: true },
        caption: { type: String, trim: true, maxlength: 200 },
      },
    ],

    // Customers can save providers they like or want to book again.
    favoriteProviders: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Aggregate rating fields, kept denormalized on the user for fast reads
    // (recalculated whenever a review is created/updated/deleted).
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },

    paymentDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      accountName: { type: String },
      paystackRecipientCode: { type: String }, // used for provider payouts
    },

    isVerified: { type: Boolean, default: false }, // email-verified flag, required to register/log in normally
    isActive: { type: Boolean, default: true }, // soft-suspend flag
    suspendedAt: { type: Date },
    suspendedReason: { type: String },

    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date }, // actual Date this time, not seconds-as-a-number
  },
  { timestamps: true },
);

userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ state: 1 }); // supports location-based provider search

userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.set("toJSON", { virtuals: true });

const User = mongoose.model("User", userSchema);
export default User;
