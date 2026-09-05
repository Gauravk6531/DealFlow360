import mongoose from "mongoose";

const dealerOfferSchema = new mongoose.Schema(
  {
    dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "Dealer", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    dealerCost: { type: Number, required: true, min: 0 },
    availableQuantity: { type: Number, default: 0, min: 0 },
    minimumAcceptablePrice: { type: Number, default: 0, min: 0 },
    deliveryDays: { type: Number, default: 3, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    reliabilityScore: { type: Number, default: 90 },
    promotionalDiscount: { type: Number, default: 0, min: 0 },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

dealerOfferSchema.index({ dealerId: 1, productId: 1 });

export default mongoose.model("DealerOffer", dealerOfferSchema);