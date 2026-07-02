import mongoose from "mongoose";

const providerListingSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      required: true,
    },
    // Denormalized so "Other" / custom services don't need a real category
    // doc yet, and so listing titles can differ from the category name
    // (e.g. category "Plumbing", title "Emergency pipe burst repair").
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    pricingUnit: { type: String, default: "per job", trim: true }, // "per hour", "per job", etc

    location: { type: String, trim: true }, // free-text label, e.g. "Owerri, Imo State"
    // Optional precise coordinates for radius-based "near me" search.
    // Free-text `location` above remains the fallback for browsing/display
    // and for providers who haven't shared a pinpoint location.
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    estimatedTime: { type: String, trim: true }, // e.g. "1-2 hours"

    images: [{ type: String }], // public URLs/paths served from /uploads/services
    videos: [{ type: String }],

    isActive: { type: Boolean, default: true }, // provider can pause a listing
    isFeatured: { type: Boolean, default: false }, // admin can feature on homepage

    // A listing only appears on the public Services page and can only
    // accept bookings once an admin/owner has reviewed and verified it.
    // This is deliberately per-listing, not per-provider-account: a
    // provider's account just needs email verification (User.isVerified)
    // to operate their dashboard, but each individual service they offer
    // is checked separately before it goes live.
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verificationNotes: { type: String, trim: true, maxlength: 500 }, // admin's reason if rejected

    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    bookingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

providerListingSchema.index({ provider: 1 });
providerListingSchema.index({ category: 1 });
providerListingSchema.index({ isActive: 1, isFeatured: 1, isVerified: 1 });
providerListingSchema.index({ title: "text", description: "text" });

providerListingSchema.index({ "coordinates.lat": 1, "coordinates.lng": 1 });

const ProviderListing = mongoose.model("ProviderListing", providerListingSchema);
export default ProviderListing;
