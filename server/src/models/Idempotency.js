import mongoose from "mongoose";

const idempotencySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    userId: { type: String, required: true },
    endpoint: { type: String, required: true },
    response: { type: mongoose.Schema.Types.Mixed, required: true },
    statusCode: { type: Number, default: 200 },
  },
  { timestamps: true }
);

idempotencySchema.index({ key: 1, userId: 1 }, { unique: true });
idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("Idempotency", idempotencySchema);