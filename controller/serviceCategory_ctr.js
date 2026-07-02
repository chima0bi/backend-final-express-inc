import ServiceCategory from "../model/serviceCategory_model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, icon } = req.body;

  const existing = await ServiceCategory.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
  if (existing) {
    return res.status(409).json({ message: "This category already exists" });
  }

  const category = await ServiceCategory.create({ name, description, icon });
  return res.status(201).json({ message: "Category created successfully", category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, isActive } = req.body;
  const category = await ServiceCategory.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }
  if (name !== undefined) category.name = name;
  if (description !== undefined) category.description = description;
  if (icon !== undefined) category.icon = icon;
  if (isActive !== undefined) category.isActive = isActive;
  await category.save();
  return res.status(200).json({ message: "Category updated successfully", category });
});

// Public - used by Register.jsx and Services.jsx for the service/category dropdown
export const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await ServiceCategory.find({ isActive: true }).sort({ name: 1 });
  return res.status(200).json({ message: "Categories retrieved successfully", categories });
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await ServiceCategory.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }
  return res.status(200).json({ message: "Category retrieved successfully", category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await ServiceCategory.findByIdAndDelete(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }
  return res.status(200).json({ message: "Category deleted successfully" });
});
