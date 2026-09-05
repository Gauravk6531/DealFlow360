import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    userEmail: { type: String, default: "" },
    action: { type: String, required: true },
    entity: { type: String, default: "" },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", default: null },
    oldValue: { type: Object, default: null },
    newValue: { type: Object, default: null },
    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditLogSchema);