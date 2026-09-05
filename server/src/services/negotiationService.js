import DealerOffer from "../models/DealerOffer.js";
import Concession from "../models/Concession.js";
import { round2 } from "../utils/helpers.js";
import { effectiveDiscountLimit } from "./pricingService.js";

/**
 * =============================================================================
 * PROFIT-AWARE MULTI-DEALER NEGOTIATION ENGINE  (HERO FEATURE)
 * =============================================================================
 * Finds the BEST MUTUALLY PROFITABLE deal, never just the lowest price.
 *
 * Money flow per unit:
 *   listUnitPrice  -> customer reference price
 *   unitPrice      -> final customer price (negotiated)
 *   offer.sellingPrice -> what DealFlow360 pays the dealer  (company cost)
 *   offer.dealerCost   -> dealer's own cost
 *
 * Constraints:
 *   dealerFloor = max(offer.minimumAcceptablePrice,
 *                     offer.sellingPrice * (1 + companyMinMargin% / 100),
 *                     listUnitPrice * (1 - effectiveDiscountLimit% / 100))
 *   Every accepted price must satisfy: customer price >= dealerFloor
 *   => dealer stays above minimum profit AND company stays above minimum margin
 *      AND discount stays within policy, ALL AT ONCE.
 *
 * Decision states: AUTO_ACCEPT | COUNTER_OFFER | ESCALATE | REJECT
 * =============================================================================
 */

export async function negotiateQuote(quote, requestedTotalInput, { settings, customer, productMap, categoryLimits }) {
  // All negotiation math runs on the pre-tax subtotal (list value) so that
  // "your quote is ₹10 lakh" is compared against "I can pay ₹9 lakh"
  // directly. GST is displayed separately and never muddies the decision.
  const originalSubtotal = quote.subtotal;

  const negotiableLines = quote.lines.filter((l) => !l.isSubscription);

  if (negotiableLines.length === 0) {
    return {
      decision: "REJECT",
      reason: "No negotiable (one-time) line items on this quote.",
      recommendation: "Negotiation is not available for subscription-only quotations.",
    };
  }

  const requestedTotal = Math.max(0, Number(requestedTotalInput));
  if (!requestedTotal || requestedTotal >= originalSubtotal) {
    return {
      decision: "AUTO_ACCEPT",
      recommendedPrice: originalSubtotal,
      reason: "Requested price is above or equal to the quoted price.",
      recommendation: "Accept the existing price.",
    };
  }

  const scale = originalSubtotal > 0 ? Math.max(0, Math.min(1, requestedTotal / originalSubtotal)) : 1;

  const linePlans = [];
  let policyViolation = false;

  for (const line of negotiableLines) {
    const product = productMap.get(String(line.productId));

    const effectiveRequestedUnit = round2(line.listUnitPrice * scale);
    product.category = product.category;
    const allowedDiscount = product ? effectiveDiscountLimit(settings, customer, product) : 15;
    const requestedDiscountPct =
      line.listUnitPrice > 0 ? ((line.listUnitPrice - effectiveRequestedUnit) / line.listUnitPrice) * 100 : 0;
    if (requestedDiscountPct > allowedDiscount + 0.001) policyViolation = true;

    const offers = await fetchActiveOffers(line.productId);
    const dealerChoices = [];

    for (const offer of offers) {
      const dealer = offer.dealerId;
      const companyFloor = offer.sellingPrice * (1 + (settings.minCompanyMarginPct || 10) / 100);
      const discountFloor = line.listUnitPrice * (1 - (allowedDiscount || 15) / 100);
      const floor = Math.max(offer.minimumAcceptablePrice || 0, companyFloor, discountFloor);

      const dealerProfitUnit = offer.sellingPrice - offer.dealerCost;
      const companyProfitUnit = offer.sellingPrice * (settings.minCompanyMarginPct || 10) / 100;
      const companyMarginUnitAtFloor = floor - offer.sellingPrice;

      dealerChoices.push({
        dealerId: String(dealer?._id || offer.dealerId),
        dealerName: dealer?.name || "Unknown Dealer",
        offerId: String(offer._id),
        sellingPrice: offer.sellingPrice,
        dealerCost: offer.dealerCost,
        minAcceptablePrice: offer.minimumAcceptablePrice,
        floor,
        feasibleAtRequest: floor <= effectiveRequestedUnit,
        costAtRequest: offer.sellingPrice * line.quantity,
        dealerProfitUnit,
        dealerProfitAtFloor: dealerProfitUnit * line.quantity,
        companyProfitAtRequest: round2((effectiveRequestedUnit - offer.sellingPrice) * line.quantity),
        companyProfitAtFloor: round2(companyMarginUnitAtFloor * line.quantity),
        deliveryDays: offer.deliveryDays,
        availableQuantity: offer.availableQuantity,
        reliabilityScore: dealer?.reliabilityScore ?? offer.reliabilityScore ?? 80,
        shippingCost: offer.shippingCost || 0,
      });
    }

    // Feasible dealers at requested price, scored by overall desirability
    const feasible = dealerChoices
      .filter((d) => d.feasibleAtRequest)
      .sort((a, b) => recommendedScore(b, effectiveRequestedUnit) - recommendedScore(a, effectiveRequestedUnit));

    // Minimum achievable price per line across all dealers
    let counterChoice = null;
    let cheapestCounter = Infinity;
    for (const d of dealerChoices) {
      const cost = Math.max(d.floor, effectiveRequestedUnit) * line.quantity;
      const bid = cost + (d.shippingCost || 0);
      if (bid < cheapestCounter) {
        cheapestCounter = bid;
        counterChoice = d;
      }
    }

    linePlans.push({
      productId: String(line.productId),
      productName: product?.name || line.productName || "Product",
      quantity: line.quantity,
      listUnitPrice: line.listUnitPrice,
      effectiveRequestedUnit,
      requestedDiscountPct: round2(requestedDiscountPct),
      allowedDiscount,
      policyViolation: requestedDiscountPct > allowedDiscount + 0.001,
      feasibility: feasible,
      preferredDealer: feasible[0] || null,
      counterChoice,
      counterUnitPrice: Math.max(counterChoice.floor, effectiveRequestedUnit),
    });
  }

  const allFeasible = linePlans.every((p) => p.preferredDealer);
  const counterSubtotal = round2(linePlans.reduce((s, p) => s + (p.counterChoice ? p.counterUnitPrice * p.quantity : 0), 0));

  let decision = "REJECT";
  let recommendedPrice = null;
  let selectedDealerId = null;
  let selectedDealerName = "";
  let reason = "";
  let recommendation = "";
  let concessions = [];
  let dealerProfit = 0;
  let companyProfit = 0;
  let customerSavings = round2(originalSubtotal - counterSubtotal);

  if (policyViolation) {
    decision = "ESCALATE";
    recommendedPrice = counterSubtotal;
    reason = `Requested discount would exceed the authorized discount ceiling for ${customer.customerTier} tier. Human approval of the override is required.`;
    recommendation = "Escalated to the approval chain. A manager/finance approver may authorize the override.";
    selectedDealerId = linePlans[0]?.preferredDealer?.dealerId || null;
    selectedDealerName = linePlans[0]?.preferredDealer?.dealerName || "";
  } else if (allFeasible) {
    decision = "AUTO_ACCEPT";
    recommendedPrice = requestedTotal;
    const bestDealers = linePlans.map((p) => p.preferredDealer);
    dealerProfit = round2(bestDealers.reduce((s, d) => s + d.dealerProfitAtFloor, 0));
    companyProfit = round2(
      linePlans.reduce((s, p) => s + (p.preferredDealer ? p.preferredDealer.companyProfitAtRequest : 0), 0)
    );
    customerSavings = round2(originalSubtotal - requestedTotal);
    reason = "Requested price keeps every dealer above minimum profit, DealFlow360 above minimum margin, and stays inside discount policy.";
    recommendation = `Automatically accepted at ₹${requestedTotal.toLocaleString("en-IN")}.`;
  } else if (counterSubtotal <= originalSubtotal) {
    decision = "COUNTER_OFFER";
    recommendedPrice = counterSubtotal;

    const gap = round2(counterSubtotal - requestedTotal);
    concessions = await optimizeConcessions(gap);

    const chosen = linePlans.map((p) => p.counterChoice || p.preferredDealer).filter(Boolean);
    dealerProfit = round2(chosen.reduce((s, d) => s + d.dealerProfitAtFloor, 0));
    companyProfit = round2(
      linePlans.reduce((s, p) => {
        const d = p.counterChoice;
        return s + (d ? d.companyProfitAtFloor : 0);
      }, 0)
    );
    customerSavings = round2(originalSubtotal - counterSubtotal);
    selectedDealerId = chosen[1]?.dealerId || chosen[0]?.dealerId || null;
    selectedDealerName = chosen.map((d) => d.dealerName).join(", ");

    reason = concessions.length
      ? "Requested price would violate a dealer/company minimum margin. A slightly higher price plus value-added concessions keeps everyone profitable."
      : "Requested price would violate a dealer/company minimum margin. The counter-offer is the lowest mutually profitable price.";
    recommendation = concessions.length
      ? `Counter-offer ₹${counterSubtotal.toLocaleString("en-IN")} plus negotiated concessions: ${concessions.join(", ")}.`
      : `Counter-offer ₹${counterSubtotal.toLocaleString("en-IN")}.`;
  } else {
    decision = "REJECT";
    reason = "No profitable configuration exists at or below the original quotation. Maintaining dealer and company profitability is mandatory.";
    recommendation = "Reject the request or explore scope changes with the customer.";
  }

  return {
    decision,
    quoteId: String(quote._id),
    quoteNumber: quote.quoteNumber,
    originalPrice: originalSubtotal,
    originalSubtotal,
    customerRequestedPrice: requestedTotal,
    customerRequestedDiscount: round2((1 - requestedTotal / originalSubtotal) * 100),
    proposedPrice: recommendedPrice,
    proposedDiscount: recommendedPrice ? round2((1 - recommendedPrice / originalSubtotal) * 100) : 0,
    dealerId: selectedDealerId,
    dealerName: selectedDealerName,
    dealerOptions: linePlans.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      quantity: p.quantity,
      listUnitPrice: p.listUnitPrice,
      effectiveRequestedUnit: p.effectiveRequestedUnit,
      preferredDealer: p.preferredDealer
        ? {
            dealerId: p.preferredDealer.dealerId,
            dealerName: p.preferredDealer.dealerName,
          }
        : null,
      feasibleAtRequestDealers: p.feasibility.map((f) => ({
        dealerId: f.dealerId,
        dealerName: f.dealerName,
        priceAtRequest: p.effectiveRequestedUnit * p.quantity,
        minAcceptablePrice: f.minAcceptablePrice,
        floor: f.floor,
        deliveryDays: f.deliveryDays,
        availableQuantity: f.availableQuantity,
        reliabilityScore: f.reliabilityScore,
      })),
      counterChoice: p.counterChoice
        ? {
            dealerId: p.counterChoice.dealerId,
            dealerName: p.counterChoice.dealerName,
            counterUnitPrice: p.counterUnitPrice,
            floor: p.counterChoice.floor,
          }
        : null,
    })),
    customerSavings,
    dealerProfit,
    companyProfit,
    negotiationRound: 1,
    reason,
    recommendation,
    concessions,
    policyViolation,
  };
}

async function fetchActiveOffers(productId) {
  return DealerOffer.find({
    productId,
    active: true,
    $or: [{ validUntil: null }, { validUntil: { $gt: new Date() } }],
  }).populate("dealerId");
}

function recommendedScore(choice, unitPrice) {
  const priceScore = Math.max(0, 100 - Math.abs(unitPrice - choice.floor) / unitPrice * 400);
  const reliability = choice.reliabilityScore || 80;
  const deliveryScore = Math.max(0, 100 - choice.deliveryDays * 10);
  const inventoryScore = Math.min(100, choice.availableQuantity * 2);
  return round2(priceScore * 0.5 + reliability * 0.25 + deliveryScore * 0.15 + inventoryScore * 0.1);
}

async function optimizeConcessions(gap) {
  const concessions = await Concession.find({ available: true });
  let needed = gap;
  const chosen = [];
  if (needed <= 0) return chosen;
  const sorted = concessions
    .filter((c) => c.perceivedValue > 0)
    .sort((a, b) => b.perceivedValue / Math.max(1, b.companyCost + b.dealerCost) - a.perceivedValue / Math.max(1, a.companyCost + a.dealerCost));
  for (const c of sorted) {
    if (needed <= 0) break;
    chosen.push(c.name);
    needed -= c.perceivedValue;
  }
  return chosen.sort();
}

/**
 * Apply a counter-offer's price to the quote lines (mutates quote),
 * choosing the counter dealer for each line.
 */
export function applyCounterOfferToQuote(quote, result) {
  const negotiableLines = quote.lines.filter((l) => !l.isSubscription);
  const planMap = new Map((result.dealerOptions || []).map((o) => [o.productId, o]));
  for (const line of negotiableLines) {
    const plan = planMap.get(String(line.productId));
    if (!plan) continue;
    if (result.decision === "AUTO_ACCEPT") {
      if (plan.preferredDealer?.dealerId) line.dealerId = plan.preferredDealer.dealerId;
      line.unitPrice = plan.effectiveRequestedUnit;
    } else if (result.decision === "COUNTER_OFFER") {
      if (plan.counterChoice?.dealerId) line.dealerId = plan.counterChoice.dealerId;
      line.unitPrice = plan.counterUnitPrice;
    }
  }
}