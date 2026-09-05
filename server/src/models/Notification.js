import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    role: { type: String, default: "" },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", default: null },
    type: {
      type: String,
      enum: ["approval", "negotiation", "inventory", "risk", "system"],
      default: "system",
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);