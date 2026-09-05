import mongoose from "mongoose";

const dealerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contact: { type: String, default: "" },
    rating: { type: Number, default: 4.0, min: 0, max: 5 },
    reliabilityScore: { type: Number, default: 90, min: 0, max: 100 },
    minimumProfitMargin: { type: Number, default: 8, min: 0 },
    preferredCategories: [String],
    paymentTerms: { type: String, default: "Net 30" },
    active: { type: Boolean, default: true },
    winCount: { type: Number, default: 0 },
    deliveryPerformance: { type: Number, default: 95 },
  },
  { timestamps: true }
);

export default mongoose.model("Dealer", dealerSchema);