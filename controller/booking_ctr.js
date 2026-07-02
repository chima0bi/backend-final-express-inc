import Booking from "../model/booking_model.js";
import ProviderListing from "../model/providerListing_model.js";
import Payment from "../model/payment_model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const VALID_TRANSITIONS = {
  pending: ["accepted", "declined", "cancelled"],
  accepted: ["in-progress", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: [],
  declined: [],
  cancelled: [],
};

// CUSTOMER or PROVIDER: create a booking against a listing
export const createBooking = asyncHandler(async (req, res) => {
  const {
    listing: listingId,
    address,
    scheduledDate,
    scheduledTime,
    notes,
  } = req.body;

  const listing = await ProviderListing.findById(listingId);
  if (!listing || !listing.isActive || !listing.isVerified) {
    return res
      .status(404)
      .json({ message: "This service listing is unavailable" });
  }

  if (String(listing.provider) === String(req.user._id)) {
    return res
      .status(400)
      .json({ message: "You cannot book your own service" });
  }

  const booking = await Booking.create({
    customer: req.user._id,
    provider: listing.provider,
    listing: listing._id,
    price: listing.price,
    address,
    scheduledDate,
    scheduledTime,
    notes,
  });

  const populated = await booking.populate([
    { path: "listing", select: "title price pricingUnit" },
    { path: "provider", select: "name avatar phone" },
  ]);

  return res
    .status(201)
    .json({ message: "Booking request sent successfully", booking: populated });
});

export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, cancellationReason } = req.body;
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const isCustomer = String(booking.customer) === String(req.user._id);
  const isProvider = String(booking.provider) === String(req.user._id);
  const isAdmin = ["admin", "owner"].includes(req.user.role);

  if (!isCustomer && !isProvider && !isAdmin) {
    return res
      .status(403)
      .json({ message: "You are not part of this booking" });
  }

  const providerOnlyActions = [
    "accepted",
    "declined",
    "in-progress",
    "completed",
  ];
  if (providerOnlyActions.includes(status) && !isProvider && !isAdmin) {
    return res
      .status(403)
      .json({ message: "Only the provider can perform this action" });
  }

  const allowedNext = VALID_TRANSITIONS[booking.status] || [];
  if (!allowedNext.includes(status) && !isAdmin) {
    return res.status(400).json({
      message: `Cannot move booking from "${booking.status}" to "${status}"`,
    });
  }

  booking.status = status;
  if (status === "cancelled") {
    booking.cancelledBy = isCustomer
      ? "customer"
      : isProvider
        ? "provider"
        : "admin";
    booking.cancellationReason = cancellationReason || "No reason provided";
  }
  if (status === "completed") {
    await ProviderListing.findByIdAndUpdate(booking.listing, {
      $inc: { bookingCount: 1 },
    });
  }

  await booking.save();

  const populated = await booking.populate([
    { path: "listing", select: "title price pricingUnit" },
    { path: "customer", select: "name phone avatar" },
    { path: "provider", select: "name phone avatar" },
  ]);

  return res
    .status(200)
    .json({ message: "Booking updated successfully", booking: populated });
});

const baseBookingPopulate = [
  { path: "listing", select: "title price pricingUnit images" },
  { path: "customer", select: "name phone avatar" },
  { path: "provider", select: "name phone avatar" },
];

export const getMyBookingsAsCustomer = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = { customer: req.user._id };
  if (status && status !== "all") query.status = status;

  const bookings = await Booking.find(query)
    .populate(baseBookingPopulate)
    .sort({ createdAt: -1 });
  return res
    .status(200)
    .json({ message: "Bookings retrieved successfully", bookings });
});

export const getMyBookingsAsProvider = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = { provider: req.user._id };
  if (status && status !== "all") query.status = status;

  const bookings = await Booking.find(query)
    .populate(baseBookingPopulate)
    .sort({ createdAt: -1 });
  return res
    .status(200)
    .json({ message: "Bookings retrieved successfully", bookings });
});

export const getAllBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status && status !== "all") query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate(baseBookingPopulate)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Booking.countDocuments(query),
  ]);

  return res.status(200).json({
    message: "Bookings retrieved successfully",
    bookings,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

export const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate(
    baseBookingPopulate,
  );
  if (!booking) {
    return res.status(404).json({ message: "Booking does not exist" });
  }

  const isParticipant =
    String(booking.customer._id) === String(req.user._id) ||
    String(booking.provider._id) === String(req.user._id);
  const isAdmin = ["admin", "owner"].includes(req.user.role);

  if (!isParticipant && !isAdmin) {
    return res.status(403).json({ message: "Access denied" });
  }

  return res
    .status(200)
    .json({ message: "Booking retrieved successfully", booking });
});

export const deleteBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findByIdAndDelete(req.params.id);
  if (!booking) {
    return res.status(404).json({ message: "Booking does not exist" });
  }
  return res.status(200).json({ message: "Booking deleted successfully" });
});

// ── Analytics ────────────────────────────────────────────────────────────────

const buildMonthBuckets = (months) => {
  const buckets = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    });
  }
  return buckets;
};

export const getProviderEarningsTrend = asyncHandler(async (req, res) => {
  const months = Number(req.query.months) || 6;
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const raw = await Payment.aggregate([
    {
      $match: {
        provider: req.user._id,
        status: { $in: ["paid", "released"] },
        paidAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
        earnings: { $sum: "$providerPayout" },
      },
    },
  ]);

  const buckets = buildMonthBuckets(months);
  const series = buckets.map((b) => {
    const [year, month] = b.key.split("-").map(Number);
    const match = raw.find((r) => r._id.year === year && r._id.month === month);
    return { month: b.label, earnings: match?.earnings || 0 };
  });

  return res.status(200).json({ message: "Earnings trend retrieved", series });
});

export const getProviderBookingFunnel = asyncHandler(async (req, res) => {
  const raw = await Booking.aggregate([
    { $match: { provider: req.user._id } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const statuses = [
    "pending",
    "accepted",
    "in-progress",
    "completed",
    "declined",
    "cancelled",
  ];
  const series = statuses.map((status) => ({
    status,
    count: raw.find((r) => r._id === status)?.count || 0,
  }));
  return res.status(200).json({ message: "Booking funnel retrieved", series });
});

export const getProviderListingPerformance = asyncHandler(async (req, res) => {
  const raw = await Booking.aggregate([
    { $match: { provider: req.user._id } },
    {
      $group: {
        _id: "$listing",
        totalBookings: { $sum: 1 },
        completedBookings: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        earnings: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$price", 0] },
        },
      },
    },
    {
      $lookup: {
        from: "providerlistings",
        localField: "_id",
        foreignField: "_id",
        as: "listingDoc",
      },
    },
    { $unwind: { path: "$listingDoc", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        listingId: "$_id",
        title: { $ifNull: ["$listingDoc.title", "Deleted listing"] },
        totalBookings: 1,
        completedBookings: 1,
        earnings: 1,
      },
    },
    { $sort: { earnings: -1 } },
  ]);

  return res
    .status(200)
    .json({ message: "Listing performance retrieved", series: raw });
});

export const getCustomerSpendingTrend = asyncHandler(async (req, res) => {
  const months = Number(req.query.months) || 6;
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const raw = await Payment.aggregate([
    {
      $match: {
        customer: req.user._id,
        status: { $in: ["paid", "released"] },
        paidAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
        spent: { $sum: "$amount" },
      },
    },
  ]);

  const buckets = buildMonthBuckets(months);
  const series = buckets.map((b) => {
    const [year, month] = b.key.split("-").map(Number);
    const match = raw.find((r) => r._id.year === year && r._id.month === month);
    return { month: b.label, spent: match?.spent || 0 };
  });

  return res.status(200).json({ message: "Spending trend retrieved", series });
});

export const getCustomerCategoryBreakdown = asyncHandler(async (req, res) => {
  const raw = await Booking.aggregate([
    { $match: { customer: req.user._id } },
    {
      $lookup: {
        from: "providerlistings",
        localField: "listing",
        foreignField: "_id",
        as: "listingDoc",
      },
    },
    { $unwind: "$listingDoc" },
    {
      $lookup: {
        from: "servicecategories",
        localField: "listingDoc.category",
        foreignField: "_id",
        as: "categoryDoc",
      },
    },
    { $unwind: "$categoryDoc" },
    { $group: { _id: "$categoryDoc.name", bookings: { $sum: 1 } } },
    { $sort: { bookings: -1 } },
  ]);

  const series = raw.map((r) => ({ category: r._id, bookings: r.bookings }));
  return res
    .status(200)
    .json({ message: "Category breakdown retrieved", series });
});
