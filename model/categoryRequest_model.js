import mongoose from "mongoose";

// When a provider's service doesn't fit any existing ServiceCategory, they
// submit a request here instead of creating a category outright. An
// admin/owner reviews it and either approves (which creates the real
// ServiceCategory and links it back here) or rejects with a reason.
const categoryRequestSchema = new mongoose.Schema(
  {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNotes: { type: String, trim: true, maxlength: 500 },
    resultingCategory: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceCategory" },
  },
  { timestamps: true },
);

categoryRequestSchema.index({ status: 1, createdAt: -1 });
categoryRequestSchema.index({ requestedBy: 1 });

const CategoryRequest = mongoose.model("CategoryRequest", categoryRequestSchema);
export default CategoryRequest;
