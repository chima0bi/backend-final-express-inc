import ProviderListing from "../model/providerListing_model.js";
import ServiceCategory from "../model/serviceCategory_model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import cloudinary from "../config/cloudinary.js";

// With Cloudinary storage, multer's CloudinaryStorage engine puts the
// uploaded file's full, permanent URL on `file.path`. There's no local
// filename anymore, just the URL Cloudinary hands back - this replaces the
// old toPublicPath(filename) helper that built a "/uploads/services/<name>"
// string for local disk.

// PROVIDER: create a new listing. Media is optional at creation -
// a provider can add a bare-bones listing then attach media later via
// updateListingMedia, matching the "register first, add media after" flow.
//
// Category must be an existing, approved ServiceCategory id - providers can
// no longer create one inline here. If a provider's service doesn't fit
// anything that exists, they submit a CategoryRequest instead (see
// categoryRequest_ctr.js); only once an admin/owner approves it does it
// become selectable here.
export const createListing = asyncHandler(async (req, res) => {
  const { category, title, description, price, pricingUnit, location, estimatedTime, coordinates } = req.body;

  const categoryDoc = await ServiceCategory.findById(category);
  if (!categoryDoc) {
    return res.status(404).json({ message: "Selected category does not exist" });
  }

  const images = (req.files?.images || []).map((f) => f.path);
  const videos = (req.files?.videos || []).map((f) => f.path);

  const listing = await ProviderListing.create({
    provider: req.user._id,
    category: categoryDoc._id,
    title,
    description,
    price,
    pricingUnit,
    location: location || `${req.user.state}, ${req.user.country}`,
    coordinates,
    estimatedTime,
    images,
    videos,
  });

  await listing.populate("category", "name icon");

  return res.status(201).json({
    message: "Service listing created successfully",
    listing,
    category: categoryDoc,
  });
});

// PROVIDER: add more media to an existing listing (the dashboard "manage media" flow)
export const addListingMedia = asyncHandler(async (req, res) => {
  const listing = await ProviderListing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }
  if (
    String(listing.provider) !== String(req.user._id) &&
    req.user.role !== "admin"
  ) {
    return res
      .status(403)
      .json({ message: "You can only manage your own listings" });
  }

  const newImages = (req.files?.images || []).map((f) => f.path);
  const newVideos = (req.files?.videos || []).map((f) => f.path);

  listing.images.push(...newImages);
  listing.videos.push(...newVideos);
  await listing.save();

  return res.status(200).json({ message: "Media added successfully", listing });
});

// PROVIDER: remove a single media file from a listing
export const removeListingMedia = asyncHandler(async (req, res) => {
  const { url } = req.body; // the public path stored in images[] or videos[]
  const listing = await ProviderListing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }
  if (
    String(listing.provider) !== String(req.user._id) &&
    req.user.role !== "admin"
  ) {
    return res
      .status(403)
      .json({ message: "You can only manage your own listings" });
  }

  listing.images = listing.images.filter((img) => img !== url);
  listing.videos = listing.videos.filter((vid) => vid !== url);
  await listing.save();

  // Best-effort Cloudinary cleanup - never let this block the response,
  // since the listing's own images/videos arrays are already updated
  // either way and that's what actually controls what the frontend shows.
  // Cloudinary's destroy() needs the public_id, extracted from the URL
  // itself (the segment after "/upload/", with any version prefix like
  // "v1234567890/" and the file extension stripped).
  try {
    const isVideo = url.includes("/video/upload/");
    const afterUpload = url.split("/upload/")[1];
    const withoutVersion = afterUpload.replace(/^v\d+\//, "");
    const publicId = withoutVersion.replace(/\.[a-zA-Z0-9]+$/, "");
    await cloudinary.uploader.destroy(publicId, { resource_type: isVideo ? "video" : "image" });
  } catch (err) {
    console.warn("Could not remove file from Cloudinary:", err.message);
  }

  return res
    .status(200)
    .json({ message: "Media removed successfully", listing });
});

export const updateListing = asyncHandler(async (req, res) => {
  const listing = await ProviderListing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }
  if (
    String(listing.provider) !== String(req.user._id) &&
    req.user.role !== "admin"
  ) {
    return res
      .status(403)
      .json({ message: "You can only manage your own listings" });
  }

  const {
    category,
    title,
    description,
    price,
    pricingUnit,
    location,
    estimatedTime,
    isActive,
    coordinates,
  } = req.body;

  // Editing core content (title/description/price/category) means the
  // thing an admin approved may no longer match what's live, so it goes
  // back into the review queue. Pausing/resuming (isActive) and adjusting
  // location/pricingUnit/estimatedTime/coordinates don't trigger this -
  // those aren't substantive content changes. Only the provider's own edit
  // re-triggers review; an admin/owner correcting a typo while verifying
  // shouldn't un-verify their own action.
  let needsReverification = false;
  if (category !== undefined && String(category) !== String(listing.category)) needsReverification = true;
  if (title !== undefined && title !== listing.title) needsReverification = true;
  if (description !== undefined && description !== listing.description) needsReverification = true;
  if (price !== undefined && Number(price) !== listing.price) needsReverification = true;

  if (category !== undefined) listing.category = category;
  if (title !== undefined) listing.title = title;
  if (description !== undefined) listing.description = description;
  if (price !== undefined) listing.price = price;
  if (pricingUnit !== undefined) listing.pricingUnit = pricingUnit;
  if (location !== undefined) listing.location = location;
  if (coordinates !== undefined) listing.coordinates = coordinates;
  if (estimatedTime !== undefined) listing.estimatedTime = estimatedTime;
  if (isActive !== undefined) listing.isActive = isActive;

  if (needsReverification && req.user.role === "provider") {
    listing.isVerified = false;
    listing.verifiedAt = undefined;
    listing.verifiedBy = undefined;
  }

  await listing.save();
  return res
    .status(200)
    .json({ message: "Listing updated successfully", listing });
});

export const deleteListing = asyncHandler(async (req, res) => {
  const listing = await ProviderListing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }
  if (
    String(listing.provider) !== String(req.user._id) &&
    req.user.role !== "admin"
  ) {
    return res
      .status(403)
      .json({ message: "You can only manage your own listings" });
  }
  await listing.deleteOne();
  return res.status(200).json({ message: "Listing deleted successfully" });
});

// Haversine distance in kilometers between two lat/lng points. Used for the
// radius-based "near me" search without needing MongoDB's geospatial
// indexes/operators, which require a different index type and add setup
// complexity not worth it at this scale - fine for now, and easy to swap
// for a real $geoNear query later if the listing count grows large enough
// that filtering by distance in application code gets slow.
const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// PUBLIC: browse all active listings, with search/filter (powers Services.jsx)
export const getAllListings = asyncHandler(async (req, res) => {
  const {
    category,
    search,
    minPrice,
    maxPrice,
    minRating,
    state,
    lat,
    lng,
    radiusKm,
    page = 1,
    limit = 12,
  } = req.query;
  const query = { isActive: true, isVerified: true };

  if (category) query.category = category;
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }
  if (minRating) query.averageRating = { $gte: Number(minRating) };
  if (search) {
    query.$text = { $search: search };
  }
  // Simple text-based location filter (state/city name match) - the
  // practical default that doesn't require the customer to share their
  // browser location.
  if (state) query.location = { $regex: state, $options: "i" };

  let listings;
  let total;

  if (lat && lng) {
    // Precise radius search. Listings WITH coordinates get a real distance
    // and are sorted nearest-first. Listings WITHOUT coordinates (most
    // providers haven't clicked "use my current location" while creating
    // a listing) are no longer thrown out entirely - that was the actual
    // bug: filtering them out meant "use my location" made every listing
    // disappear on a dataset where most listings predate the coordinates
    // feature. They're now kept and shown after the precise matches,
    // without a distance badge, so the page degrades gracefully instead
    // of going empty.
    const candidates = await ProviderListing.find(query)
      .populate("provider", "name avatar averageRating reviewCount state")
      .populate("category", "name icon");

    const maxRadius = radiusKm ? Number(radiusKm) : 25; // default 25km

    const withCoords = candidates.filter((l) => l.coordinates?.lat != null && l.coordinates?.lng != null);
    const withoutCoords = candidates.filter((l) => l.coordinates?.lat == null || l.coordinates?.lng == null);

    const withDistance = withCoords
      .map((l) => ({
        listing: l,
        distance: distanceKm(Number(lat), Number(lng), l.coordinates.lat, l.coordinates.lng),
      }))
      .filter((l) => l.distance <= maxRadius)
      .sort((a, b) => a.distance - b.distance);

    const combined = [
      ...withDistance.map((l) => ({ ...l.listing.toObject(), distanceKm: Math.round(l.distance * 10) / 10 })),
      ...withoutCoords.map((l) => ({ ...l.toObject(), distanceKm: null })),
    ];

    total = combined.length;
    const skip = (Number(page) - 1) * Number(limit);
    listings = combined.slice(skip, skip + Number(limit));
  } else {
    const skip = (Number(page) - 1) * Number(limit);
    [listings, total] = await Promise.all([
      ProviderListing.find(query)
        .populate("provider", "name avatar averageRating reviewCount state")
        .populate("category", "name icon")
        .sort({ isFeatured: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ProviderListing.countDocuments(query),
    ]);
  }

  return res.status(200).json({
    message: "Listings retrieved successfully",
    listings,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

export const getFeaturedListings = asyncHandler(async (req, res) => {
  const listings = await ProviderListing.find({
    isActive: true,
    isVerified: true,
    isFeatured: true,
  })
    .populate("provider", "name avatar averageRating reviewCount")
    .populate("category", "name icon")
    .limit(6);

  // Fallback: if no admin has featured anything yet, show the best-rated active listings
  if (listings.length === 0) {
    const fallback = await ProviderListing.find({ isActive: true, isVerified: true })
      .populate("provider", "name avatar averageRating reviewCount")
      .populate("category", "name icon")
      .sort({ averageRating: -1, bookingCount: -1 })
      .limit(6);
    return res
      .status(200)
      .json({ message: "Featured listings retrieved", listings: fallback });
  }

  return res
    .status(200)
    .json({ message: "Featured listings retrieved", listings });
});

export const getListingById = asyncHandler(async (req, res) => {
  const listing = await ProviderListing.findById(req.params.id)
    .populate(
      "provider",
      "name avatar averageRating reviewCount state country experienceYears bio",
    )
    .populate("category", "name icon");
  if (!listing) {
    return res.status(404).json({ message: "Service listing not found" });
  }
  return res
    .status(200)
    .json({ message: "Listing retrieved successfully", listing });
});

// PROVIDER: get own listings (for the dashboard)
export const getMyListings = asyncHandler(async (req, res) => {
  const listings = await ProviderListing.find({ provider: req.user._id })
    .populate("category", "name icon")
    .sort({ createdAt: -1 });
  return res.status(200).json({ message: "Your listings retrieved", listings });
});

// ADMIN: feature/unfeature a listing on the homepage
export const toggleFeatured = asyncHandler(async (req, res) => {
  const listing = await ProviderListing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }
  listing.isFeatured = !listing.isFeatured;
  await listing.save();
  return res
    .status(200)
    .json({
      message: `Listing ${listing.isFeatured ? "featured" : "unfeatured"}`,
      listing,
    });
});

// ADMIN/OWNER: the verification review queue - all listings awaiting a
// decision, oldest first so nothing sits forgotten.
export const getPendingVerificationListings = asyncHandler(async (req, res) => {
  const listings = await ProviderListing.find({ isVerified: false })
    .populate("provider", "name email phone")
    .populate("category", "name icon")
    .sort({ createdAt: 1 });
  return res.status(200).json({ message: "Pending listings retrieved", listings });
});

// ADMIN/OWNER: approve or reject a listing's verification
export const reviewListingVerification = asyncHandler(async (req, res) => {
  const { isVerified, verificationNotes } = req.body;
  const listing = await ProviderListing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }

  listing.isVerified = isVerified;
  listing.verificationNotes = verificationNotes;
  if (isVerified) {
    listing.verifiedAt = new Date();
    listing.verifiedBy = req.user._id;
  } else {
    listing.verifiedAt = undefined;
    listing.verifiedBy = undefined;
  }
  await listing.save();

  return res.status(200).json({
    message: isVerified ? "Listing verified and now live" : "Listing marked as not verified",
    listing,
  });
});
