import mongoose from "mongoose";

const negotiationSchema = new mongoose.Schema(
  {
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    requestedBy: { type: String, enum: ["Customer", "SalesRep"], default: "Customer" },
    originalPrice: { type: Number, required: true },
    customerRequestedPrice: { type: Number, required: true },
    customerRequestedDiscount: { type: Number, default: 0 },
    proposedPrice: { type: Number, default: null },
    proposedDiscount: { type: Number, default: 0 },
    selectedDealer: { type: mongoose.Schema.Types.ObjectId, ref: "Dealer", default: null },
    dealerOptions: { type: Object, default: null },
    customerSavings: { type: Number, default: 0 },
    dealerProfit: { type: Number, default: 0 },
    companyProfit: { type: Number, default: 0 },
    negotiationRound: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["Pending", "Counter Offered", "Approved", "Rejected", "Escalated", "Accepted"],
      default: "Pending",
    },
    decision: { type: String, default: "" },
    recommendation: { type: String, default: "" },
    reason: { type: String, default: "" },
    concessions: [String],
    riskScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Negotiation", negotiationSchema);