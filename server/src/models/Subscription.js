import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    billingCycle: { type: String, enum: ["Monthly", "Quarterly", "Yearly"], default: "Monthly" },
    price: { type: Number, required: true, min: 0 },
    prorationRule: { type: String, default: "Daily proration on mid-cycle changes" },
    cancellationRule: { type: String, default: "30-day notice, paid period honored" },
    refundRule: { type: String, default: "Unused period refunded pro-rata" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", subscriptionSchema);