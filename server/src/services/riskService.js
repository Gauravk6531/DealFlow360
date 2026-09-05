import { round2 } from "../utils/helpers.js";
import { effectiveDiscountLimit } from "./pricingService.js";

/**
 * Blended Discount Risk Score
 * ------------------------------------------------------------------
 * For every line compute lineDiscountPct vs the effective ceiling
 *   limit = min(tierDiscountLimit, categoryDiscountLimit)
 * A violation of +1% over the ceiling contributes 8 risk points.
 * Blended score = sum of all per-line violations (prevents hiding
 * excess discounting across multiple lines).
 *
 * Additional contributions:
 *  - Quote discount above the customer's historical average (+excess, capped)
 *  - Company margin below the configured minimum (+shortfall)
 *  - Any line priced below dealer minimum acceptable (+20 per line)
 */
export function computeRisk(quote, { settings, customer, productMap, offerMap }) {
  const reasons = [];
  let blendedViolation = 0;
  let managerRisk = 0;

  const overageWeight = 8;

  for (const line of quote.lines || []) {
    const product = productMap.get(String(line.productId));
    if (!product) continue;
    const allowed = effectiveDiscountLimit(settings, customer, product);
    const lineDiscount = line.discountPct || 0;
    const overage = Math.max(0, round2(lineDiscount - allowed));
    if (overage > 0) {
      blendedViolation += overage * overageWeight;
      reasons.push(`${product.name}: ${lineDiscount}% discount exceeds ${allowed}% ceiling`);
    }

    const offer = offerMap.get(`${line.dealerId}|${line.productId}`);
    if (offer && line.unitPrice < offer.minimumAcceptablePrice) {
      managerRisk += 20;
      reasons.push(`${product.name} priced below dealer minimum acceptable price`);
    }
  }

  let historicalRisk = 0;
  const historicalAvg = customer.historicalAverageDiscount || 0;
  const overshootFactor = settings.historicalDiscountOvershoot ?? 0.15;
  const allowedHistory = historicalAvg * (1 + overshootFactor);
  if (quote.weightedDiscountPct > allowedHistory) {
    historicalRisk = round2((quote.weightedDiscountPct - allowedHistory) * 2);
    reasons.push(
      `Discount ${quote.weightedDiscountPct}% exceeds historical average ${historicalAvg}% (blended +${historicalRisk})`
    );
  }

  let marginRisk = 0;
  const minMargin = settings.minCompanyMarginPct ?? 10;
  if (quote.marginPercentage < minMargin) {
    marginRisk = round2(minMargin - quote.marginPercentage);
    reasons.push(`Company margin ${quote.marginPercentage}% below minimum ${minMargin}%`);
  }

  const riskScore = round2(blendedViolation + historicalRisk + managerRisk + marginRisk);
  const level = riskScore <= (settings.approvalThresholds?.autoMax ?? 20) ? "Low"
    : riskScore <= (settings.approvalThresholds?.managerMax ?? 50) ? "Medium"
      : "High";

  return {
    riskScore,
    riskLevel: level,
    discountPolicyViolation: blendedViolation > 0,
    blendedViolation: round2(blendedViolation),
    historicalRisk,
    marginRisk,
    managerRisk,
    reasons,
    approvalChain: buildApprovalChain(riskScore, settings),
  };
}

export function buildApprovalChain(riskScore, settings) {
  const autoMax = settings.approvalThresholds?.autoMax ?? 20;
  const managerMax = settings.approvalThresholds?.managerMax ?? 50;
  if (riskScore <= autoMax) return [];
  if (riskScore <= managerMax) return ["SALES_MANAGER"];
  return ["SALES_MANAGER", "FINANCE"];
}