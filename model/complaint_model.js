import mongoose from "mongoose";

// A customer or provider can raise a complaint about a specific booking
// (e.g. job not done as described, no-show, payment dispute). Admins
// triage and resolve these.
const complaintSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    against: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // the other party in the booking
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["open", "investigating", "resolved", "dismissed"],
      default: "open",
    },
    resolutionNotes: { type: String, trim: true, maxlength: 1000 },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ booking: 1 });

const Complaint = mongoose.model("Complaint", complaintSchema);
export default Complaint;
