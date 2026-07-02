import mongoose from "mongoose";

const serviceCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: { type: String, trim: true },
    icon: { type: String, default: "Wrench" }, // lucide-react icon name
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

serviceCategorySchema.pre("validate", async function () {
  if (this.name && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-");
  }
}); //replaced existing code here with suggestion from AI to solve seeding problems (cuased by combination of (next) in the function head and next() in the function body)

const ServiceCategory = mongoose.model("ServiceCategory", serviceCategorySchema);
export default ServiceCategory;
