import mongoose from "mongoose";
import { DEFAULT_SETTINGS } from "../config/constants.js";

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default" },
    tierDiscountLimits: { type: Object, default: DEFAULT_SETTINGS.tierDiscountLimits },
    categoryDiscountLimits: { type: Object, default: DEFAULT_SETTINGS.categoryDiscountLimits },
    approvalThresholds: {
      autoMax: { type: Number, default: 20 },
      managerMax: { type: Number, default: 50 },
    },
    minCompanyMarginPct: { type: Number, default: 10 },
    dealerMinMarginPct: { type: Number, default: 8 },
    negotiationBudget: { type: Number, default: 50000 },
    risk: { type: Object, default: DEFAULT_SETTINGS.risk },
    historicalDiscountOvershoot: { type: Number, default: 0.15 },
  },
  { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);