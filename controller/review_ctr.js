import Review from "../model/review_model.js";
import Booking from "../model/booking_model.js";
import ProviderListing from "../model/providerListing_model.js";
import User from "../model/user_model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const recalculateRatings = async (providerId, listingId) => {
  const [providerAgg] = await Review.aggregate([
    { $match: { provider: providerId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await User.findByIdAndUpdate(providerId, {
    averageRating: providerAgg ? Math.round(providerAgg.avg * 10) / 10 : 0,
    reviewCount: providerAgg ? providerAgg.count : 0,
  });

  const [listingAgg] = await Review.aggregate([
    { $match: { listing: listingId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await ProviderListing.findByIdAndUpdate(listingId, {
    averageRating: listingAgg ? Math.round(listingAgg.avg * 10) / 10 : 0,
    reviewCount: listingAgg ? listingAgg.count : 0,
  });
};

// CUSTOMER: leave a review - only allowed on a completed booking they own, once
export const createReview = asyncHandler(async (req, res) => {
  const { booking: bookingId, rating, comment } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }
  if (String(booking.customer) !== String(req.user._id)) {
    return res.status(403).json({ message: "You can only review your own bookings" });
  }
  if (booking.status !== "completed") {
    return res.status(400).json({ message: "You can only review completed bookings" });
  }
  if (booking.isReviewed) {
    return res.status(409).json({ message: "This booking has already been reviewed" });
  }

  const review = await Review.create({
    booking: booking._id,
    customer: req.user._id,
    provider: booking.provider,
    listing: booking.listing,
    rating,
    comment,
  });

  booking.isReviewed = true;
  await booking.save();

  await recalculateRatings(booking.provider, booking.listing);

  return res.status(201).json({ message: "Review submitted successfully", review });
});

export const getListingReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ listing: req.params.listingId })
    .populate("customer", "name avatar")
    .sort({ createdAt: -1 });
  return res.status(200).json({ message: "Reviews retrieved successfully", reviews });
});

export const getProviderReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ provider: req.params.providerId })
    .populate("customer", "name avatar")
    .populate("listing", "title")
    .sort({ createdAt: -1 });
  return res.status(200).json({ message: "Reviews retrieved successfully", reviews });
});

// PROVIDER: respond to a review left on their service
export const respondToReview = asyncHandler(async (req, res) => {
  const { response } = req.body;
  const review = await Review.findById(req.params.id);
  if (!review) {
    return res.status(404).json({ message: "Review not found" });
  }
  if (String(review.provider) !== String(req.user._id)) {
    return res.status(403).json({ message: "You can only respond to reviews on your own services" });
  }
  review.providerResponse = response;
  review.respondedAt = new Date();
  await review.save();
  return res.status(200).json({ message: "Response added", review });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) {
    return res.status(404).json({ message: "Review not found" });
  }
  await Booking.findByIdAndUpdate(review.booking, { isReviewed: false });
  await recalculateRatings(review.provider, review.listing);
  return res.status(200).json({ message: "Review deleted successfully" });
});
