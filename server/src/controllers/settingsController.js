import Settings from "../models/Settings.js";
import { ApiError } from "../utils/error.js";
import { asyncHandler } from "../utils/helpers.js";

export const getSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne({ key: "default" });
  if (!settings) settings = await Settings.create({ key: "default" });
  res.json({ success: true, settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne({ key: "default" });
  if (!settings) settings = new Settings({ key: "default" });
  const { tierDiscountLimits, categoryDiscountLimits, approvalThresholds, minCompanyMarginPct, dealerMinMarginPct, negotiationBudget, risk, historicalDiscountOvershoot } = req.body;
  if (tierDiscountLimits) settings.tierDiscountLimits = tierDiscountLimits;
  if (categoryDiscountLimits) settings.categoryDiscountLimits = categoryDiscountLimits;
  if (approvalThresholds) settings.approvalThresholds = { ...settings.approvalThresholds?.toObject?.() || settings.approvalThresholds, ...approvalThresholds };
  if (minCompanyMarginPct !== undefined) settings.minCompanyMarginPct = Number(minCompanyMarginPct);
  if (dealerMinMarginPct !== undefined) settings.dealerMinMarginPct = Number(dealerMinMarginPct);
  if (negotiationBudget !== undefined) settings.negotiationBudget = Number(negotiationBudget);
  if (risk) settings.risk = { ...settings.risk?.toObject?.() || settings.risk, ...risk };
  if (historicalDiscountOvershoot !== undefined) settings.historicalDiscountOvershoot = Number(historicalDiscountOvershoot);
  await settings.save();
  res.json({ success: true, settings });
});