import mongoose from "mongoose";

export const APPROVAL_STATUS = ["Pending", "Approved", "Rejected", "Expired", "Skipped"];

const approvalSchema = new mongoose.Schema(
  {
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", required: true },
    approvalLevel: { type: Number, default: 1 },
    approverRole: { type: String, default: "" },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: APPROVAL_STATUS, default: "Pending" },
    reason: { type: String, default: "" },
    previousValue: { type: Object, default: null },
    newValue: { type: Object, default: null },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Approval", approvalSchema);