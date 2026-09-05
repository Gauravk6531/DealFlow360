import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  name: String,
  options: [String],
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true },
    category: {
      type: String,
      enum: ["Hardware", "Software", "Services", "Subscription", "Accessories"],
      default: "Hardware",
    },
    description: { type: String, default: "" },
    basePrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "unit" },
    tax: { type: Number, default: 18 },
    images: [String],
    variants: [variantSchema],
    subscriptionEligible: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);