import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 5 },
    replenishmentTime: { type: Number, default: 3 },
  },
  { timestamps: true }
);

inventorySchema.path("quantity").get((v) => v ?? 0);
inventorySchema.path("reservedQuantity").get((v) => v ?? 0);

inventorySchema.virtual("available").get(function () {
  return Math.max(0, (this.quantity || 0) - (this.reservedQuantity || 0));
});

inventorySchema.set("toJSON", { virtuals: true });
inventorySchema.set("toObject", { virtuals: true });

inventorySchema.index({ warehouseId: 1, productId: 1 }, { unique: true });

export default mongoose.model("Inventory", inventorySchema);