import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, default: "" },
    shippingCostWeight: { type: Number, default: 1, min: 0 },
    priority: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Warehouse", warehouseSchema);