import { asyncHandler } from "../utils/helpers.js";
import { salesDashboard, dealIntelligence, dealerIntelligence } from "../services/dashboardService.js";
import Settings from "../models/Settings.js";

async function getSettings() {
  let s = await Settings.findOne({ key: "default" });
  if (!s) s = await Settings.create({ key: "default" });
  return s;
}

export const dashboard = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await salesDashboard({ settings });
  res.json({ success: true, ...data });
});

export const dealIntelligenceCtl = asyncHandler(async (req, res) => {
  const data = await dealIntelligence();
  res.json({ success: true, ...data });
});

export const dealerIntelligenceCtl = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await dealerIntelligence(settings);
  res.json({ success: true, ...data });
});