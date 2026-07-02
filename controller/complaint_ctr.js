import Complaint from "../model/complaint_model.js";
import Booking from "../model/booking_model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// CUSTOMER or PROVIDER: raise a complaint about a booking they're part of.
// "against" is inferred automatically as the other party in the booking,
// so the person filing doesn't have to know/supply the other user's id.
export const createComplaint = asyncHandler(async (req, res) => {
  const { booking: bookingId, subject, description } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const isCustomer = String(booking.customer) === String(req.user._id);
  const isProvider = String(booking.provider) === String(req.user._id);
  if (!isCustomer && !isProvider) {
    return res.status(403).json({ message: "You can only file a complaint about your own bookings" });
  }

  const against = isCustomer ? booking.provider : booking.customer;

  const complaint = await Complaint.create({
    booking: booking._id,
    raisedBy: req.user._id,
    against,
    subject,
    description,
  });

  return res.status(201).json({ message: "Complaint submitted. An admin will review it shortly.", complaint });
});

// Person who filed it: track their own complaints
export const getMyComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ raisedBy: req.user._id })
    .populate("against", "name")
    .populate("booking", "scheduledDate status")
    .sort({ createdAt: -1 });
  return res.status(200).json({ message: "Your complaints retrieved", complaints });
});

// ADMIN/OWNER: full queue, optionally filtered by status
export const getAllComplaints = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status && status !== "all") query.status = status;

  const complaints = await Complaint.find(query)
    .populate("raisedBy", "name email role")
    .populate("against", "name email role")
    .populate("booking", "scheduledDate status price")
    .populate("handledBy", "name")
    .sort({ createdAt: -1 });

  return res.status(200).json({ message: "Complaints retrieved", complaints });
});

// ADMIN/OWNER: triage/resolve
export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, resolutionNotes } = req.body;
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found" });
  }

  complaint.status = status;
  complaint.handledBy = req.user._id;
  if (resolutionNotes !== undefined) complaint.resolutionNotes = resolutionNotes;
  if (["resolved", "dismissed"].includes(status)) complaint.resolvedAt = new Date();

  await complaint.save();
  return res.status(200).json({ message: "Complaint updated", complaint });
});
