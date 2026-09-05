import Negotiation from "../models/Negotiation.js";
import Approval from "../models/Approval.js";
import Inventory from "../models/Inventory.js";

/**
 * Explainable Deal Health Score (0-100). Contributions reduce from a 100 baseline:
 *  - inactivity (days since last interaction)
 *  - negotiation fatigue (number of rounds)
 *  - approval delay
 *  - discount risk
 *  - margin risk
 *  - inventory / delivery risk
 *  - quote age
 */
export async function computeDealHealth(quote, { settings, risk }) {
  const deductions = [];
  let score = 100;

  const daysSinceUpdated = (Date.now() - new Date(quote.updatedAt || quote.createdAt).getTime()) / 86400000;

  const inact = settings.risk?.inactivityDays ?? 5;
  if (daysSinceUpdated > inact) {
    const d = Math.min(30, Math.round(daysSinceUpdated - inact));
    score -= 5 + d;
    deductions.push(`Customer inactive for ${Math.round(daysSinceUpdated)} days`);
  }

  const negotiationCount = await Negotiation.countDocuments({ quoteId: quote._id });
  if (negotiationCount >= (settings.risk?.highNegotiationRounds ?? 3)) {
    score -= 10;
    deductions.push("Multiple negotiation rounds indicate risk of churn");
  }

  const pendingApprovals = await Approval.find({ quoteId: quote._id, status: "Pending" }).countDocuments();
  if (pendingApprovals > 0) {
    const first = await Approval.findOne({ quoteId: quote._id, status: "Pending" }).sort({ createdAt: 1 });
    const delayDays = first ? (Date.now() - new Date(first.createdAt).getTime()) / 86400000 : 0;
    score -= 10;
    score -= Math.min(15, Math.round(delayDays * (settings.risk?.approvalWeight ?? 10) / 10));
    deductions.push(`Approval pending${first ? ` for ${Math.round(delayDays)} day(s)` : ""}`);
  }

  if ((risk?.riskScore ?? 0) > (settings.approvalThresholds?.autoMax ?? 20)) {
    score -= Math.min(25, (risk.riskScore ?? 0) / 3);
    deductions.push(`Discount risk score ${risk.riskScore}`);
  }

  if ((quote.marginPercentage ?? 100) < (settings.minCompanyMarginPct ?? 10)) {
    score -= 15;
    deductions.push("Margin below company minimum");
  }

  let inventoryShortfall = 0;
  for (const line of quote.lines) {
    const total = await Inventory.aggregate([
      { $match: { productId: line.productId } },
      { $group: { _id: null, qty: { $sum: { $subtract: ["$quantity", "$reservedQuantity"] } } } },
    ]);
    const available = total[0]?.qty || 0;
    if (available < line.quantity) {
      inventoryShortfall += line.quantity - available;
    }
  }
  if (inventoryShortfall > 0) {
    score -= Math.min(20, inventoryShortfall * 2);
    deductions.push(`Inventory shortage of ${inventoryShortfall} units`);
  }

  if (quote.expiresAt && new Date(quote.expiresAt) < new Date()) {
    score -= 15;
    deductions.push("Quote has expired");
  }

  const healthScore = Math.max(0, Math.round(score));
  return {
    dealHealthScore: healthScore,
    dealHealthStatus: healthScore >= 70 ? "Healthy" : healthScore >= 45 ? "At Risk" : "Critical",
    deductions,
    factors: {
      inactivityDays: Math.round(daysSinceUpdated),
      negotiationRounds: negotiationCount,
      pendingApprovals,
      riskScore: risk?.riskScore ?? 0,
      marginPercentage: quote.marginPercentage,
      inventoryShortfall,
    },
  };
}