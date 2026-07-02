import User from "../model/user_model.js";
import Booking from "../model/booking_model.js";
import ProviderListing from "../model/providerListing_model.js";
import Payment from "../model/payment_model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getAdminStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalProviders,
    totalBookings,
    activeListings,
    completedBookings,
    revenueAgg,
  ] = await Promise.all([
    User.countDocuments({ role: "user" }),
    User.countDocuments({ role: "provider" }),
    Booking.countDocuments(),
    ProviderListing.countDocuments({ isActive: true }),
    Booking.countDocuments({ status: "completed" }),
    Payment.aggregate([
      { $match: { status: { $in: ["paid", "released"] } } },
      { $group: { _id: null, total: { $sum: "$platformFee" } } },
    ]),
  ]);

  const pendingReports = 0;

  return res.status(200).json({
    message: "Stats retrieved successfully",
    totalUsers,
    totalProviders,
    totalBookings,
    activeListings,
    completedBookings,
    platformRevenue: revenueAgg[0]?.total || 0,
    pendingReports,
  });
});

export const getRecentUsers = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 5;
  const users = await User.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("name email role createdAt");
  return res.status(200).json({ message: "Recent users retrieved", users });
});

export const getRecentBookings = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 5;
  const bookings = await Booking.find()
    .populate("customer", "name")
    .populate("provider", "name")
    .populate("listing", "title")
    .sort({ createdAt: -1 })
    .limit(limit);
  return res
    .status(200)
    .json({ message: "Recent bookings retrieved", bookings });
});

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

export const getPlatformGrowth = asyncHandler(async (req, res) => {
  const months = Number(req.query.months) || 6;
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const raw = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        role: { $in: ["user", "provider"] },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          role: "$role",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const buckets = buildMonthBuckets(months);
  const series = buckets.map((b) => {
    const [year, month] = b.key.split("-").map(Number);
    const customers =
      raw.find(
        (r) =>
          r._id.year === year && r._id.month === month && r._id.role === "user",
      )?.count || 0;
    const providers =
      raw.find(
        (r) =>
          r._id.year === year &&
          r._id.month === month &&
          r._id.role === "provider",
      )?.count || 0;
    return { month: b.label, customers, providers };
  });

  return res.status(200).json({ message: "Platform growth retrieved", series });
});

export const getRevenueTrend = asyncHandler(async (req, res) => {
  const months = Number(req.query.months) || 6;
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const raw = await Payment.aggregate([
    {
      $match: {
        status: { $in: ["paid", "released"] },
        paidAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
        revenue: { $sum: "$platformFee" },
        gross: { $sum: "$amount" },
      },
    },
  ]);

  const buckets = buildMonthBuckets(months);
  const series = buckets.map((b) => {
    const [year, month] = b.key.split("-").map(Number);
    const match = raw.find((r) => r._id.year === year && r._id.month === month);
    return {
      month: b.label,
      revenue: match?.revenue || 0,
      gross: match?.gross || 0,
    };
  });

  return res.status(200).json({ message: "Revenue trend retrieved", series });
});

export const getBookingFunnel = asyncHandler(async (req, res) => {
  const raw = await Booking.aggregate([
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

export const getTopCategories = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 8;

  const raw = await Booking.aggregate([
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
    { $limit: limit },
  ]);

  const series = raw.map((r) => ({ category: r._id, bookings: r.bookings }));
  return res.status(200).json({ message: "Top categories retrieved", series });
});
