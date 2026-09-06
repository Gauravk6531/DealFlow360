import mongoose from "mongoose";

const lineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    listUnitPrice: { type: Number, default: 0 },
    discountPct: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "Dealer", default: null },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", default: null },
    cost: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    marginPct: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    deliveryDays: { type: Number, default: 0 },
    backorder: { type: Number, default: 0 },
    taxable: { type: Boolean, default: true },
    isSubscription: { type: Boolean, default: false },
    billingCycle: { type: String, enum: ["Monthly", "Quarterly", "Yearly"], default: null },
    productName: { type: String, default: "" },
    comment: { type: String, default: "" },
  },
  { _id: true }
);

const quoteSchema = new mongoose.Schema(
  {
    quoteNumber: { type: String, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    salesRepId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lines: [lineSchema],
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 },
    estimatedMargin: { type: Number, default: 0 },
    marginPercentage: { type: Number, default: 0 },
    weightedDiscountPct: { type: Number, default: 0 },
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ["Low", "Medium", "High"], default: "Low" },
    riskReasons: [String],
    dealHealthScore: { type: Number, default: 100 },
    dealHealthStatus: { type: String, default: "Healthy" },
    approvalStatus: {
      type: String,
      enum: ["Not Required", "Pending", "Approved", "Rejected"],
      default: "Not Required",
    },
    approvalChain: [String],
    fulfillmentStatus: {
      type: String,
      enum: ["Pending", "Planned", "In Transit", "Delivered", "Partial"],
      default: "Pending",
    },
    negotiationStatus: {
      type: String,
      enum: ["None", "Negotiating", "Counter Offered", "Accepted"],
      default: "None",
    },
    customerSavings: { type: Number, default: 0 },
    requestedPrice: { type: Number, default: null },
    version: { type: Number, default: 1 },
    notes: { type: String, default: "" },
    expiresAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    wonAt: { type: Date, default: null },
    lostAt: { type: Date, default: null },
    invoiceIssued: { type: Boolean, default: false },
    latestDealerRecommendation: { type: Object, default: null },
  },
  { timestamps: true }
);

quoteSchema.pre("save", async function () {
  if (!this.quoteNumber) {
    this.quoteNumber = `Q-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
  }
});

export default mongoose.model("Quotation", quoteSchema);