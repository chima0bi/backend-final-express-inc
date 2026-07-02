import CategoryRequest from "../model/categoryRequest_model.js";
import ServiceCategory from "../model/serviceCategory_model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createCategoryRequest = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const existingCategory = await ServiceCategory.findOne({
    name: { $regex: `^${name.trim()}$`, $options: "i" },
  });
  if (existingCategory) {
    return res.status(409).json({
      message: `"${existingCategory.name}" already exists as a category — select it directly instead of requesting it.`,
      existingCategory,
    });
  }

  const existingPendingRequest = await CategoryRequest.findOne({
    name: { $regex: `^${name.trim()}$`, $options: "i" },
    status: "pending",
  });
  if (existingPendingRequest) {
    return res.status(409).json({ message: "A request for this category name is already pending review." });
  }

  const request = await CategoryRequest.create({
    requestedBy: req.user._id,
    name: name.trim(),
    description,
  });

  return res.status(201).json({
    message: "Category request submitted. You'll be able to use it once an admin approves it.",
    request,
  });
});

export const getMyCategoryRequests = asyncHandler(async (req, res) => {
  const requests = await CategoryRequest.find({ requestedBy: req.user._id })
    .populate("resultingCategory", "name icon")
    .sort({ createdAt: -1 });
  return res.status(200).json({ message: "Your category requests retrieved", requests });
});

export const getAllCategoryRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status && status !== "all") query.status = status;

  const requests = await CategoryRequest.find(query)
    .populate("requestedBy", "name email")
    .populate("reviewedBy", "name")
    .populate("resultingCategory", "name icon")
    .sort({ createdAt: -1 });

  return res.status(200).json({ message: "Category requests retrieved", requests });
});

export const reviewCategoryRequest = asyncHandler(async (req, res) => {
  const { status, reviewNotes, icon } = req.body;
  const request = await CategoryRequest.findById(req.params.id);

  if (!request) {
    return res.status(404).json({ message: "Category request not found" });
  }
  if (request.status !== "pending") {
    return res.status(409).json({ message: `This request has already been ${request.status}` });
  }

  if (status === "approved") {
    const existingCategory = await ServiceCategory.findOne({
      name: { $regex: `^${request.name}$`, $options: "i" },
    });
    const category =
      existingCategory ||
      (await ServiceCategory.create({
        name: request.name,
        description: request.description,
        icon: icon || "Sparkles",
      }));

    request.resultingCategory = category._id;
  }

  request.status = status;
  request.reviewedBy = req.user._id;
  request.reviewNotes = reviewNotes;
  await request.save();
  await request.populate(["requestedBy", "resultingCategory"]);

  return res.status(200).json({
    message: status === "approved" ? "Category request approved and category created" : "Category request rejected",
    request,
  });
});
