import mongoose from "mongoose";

const concessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    perceivedValue: { type: Number, required: true, min: 0 },
    companyCost: { type: Number, default: 0, min: 0 },
    dealerCost: { type: Number, default: 0, min: 0 },
    category: { type: String, default: "Value" },
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Concession", concessionSchema);