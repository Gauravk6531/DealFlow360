import Quotation from "../models/Quotation.js";
import Negotiation from "../models/Negotiation.js";
import Approval from "../models/Approval.js";
import Dealer from "../models/Dealer.js";
import DealerOffer from "../models/DealerOffer.js";
import { scoreOffer } from "./dealerService.js";
import Customer from "../models/Customer.js";
import { deriveStage } from "../utils/helpers.js";

export async function salesDashboard({ settings, productMap }) {
  const quotes = await Quotation.find({}).populate("customerId");

  const pipeline = quotes.filter((q) => deriveStage(q) !== "Lost" && deriveStage(q) !== "Draft");
  const won = quotes.filter((q) => q.wonAt && q.confirmedAt);

  const pipelineValue = pipeline.reduce((s, q) => s + (q.total || 0), 0);
  const wonValue = won.reduce((s, q) => s + (q.total || 0), 0);
  const atRisk = quotes.filter((q) => q.riskLevel === "High" || q.dealHealthStatus === "At Risk" || q.dealHealthStatus === "Critical");
  const pendingApprovals = await Approval.countDocuments({ status: "Pending" });

  const submitted = quotes.filter((q) => q.submittedAt);
  const avgDiscount = submitted.length
    ? submitted.reduce((s, q) => s + (q.weightedDiscountPct || 0), 0) / submitted.length
    : 0;

  const byStage = {};
  quotes.forEach((q) => {
    const st = deriveStage(q);
    byStage[st] = (byStage[st] || 0) + 1;
  });

  const negotiations = await Negotiation.find({}).sort({ createdAt: -1 }).limit(5).populate("customerId");

  return {
    stats: {
      pipelineValue: Math.round(pipelineValue),
      pipelineCount: pipeline.length,
      quotesCreated: quotes.length,
      conversionRate: submitted.length ? Math.round((won.length / submitted.length) * 100) : 0,
      revenue: Math.round(wonValue),
      wonCount: won.length,
      avgDiscount: Math.round(avgDiscount * 10) / 10,
      pendingApprovals,
      atRiskCount: atRisk.length,
      activeNegotiations: quotes.filter((q) => ["Negotiation", "Counter Offered"].includes(q.negotiationStatus)).length,
    },
    pipelineValue,
    atRisk,
    byStage,
    recentNegotiations: negotiations.map((n) => ({
      id: String(n._id),
      quoteId: String(n.quoteId),
      customer: n.customerId?.name || "Customer",
      requested: n.customerRequestedPrice,
      proposed: n.proposedPrice,
      decision: n.decision,
      status: n.status,
      round: n.negotiationRound,
      createdAt: n.createdAt,
    })),
  };
}

export async function dealIntelligence() {
  const quotes = await Quotation.find({}).populate("customerId");
  const buckets = { healthy: [], atRisk: [], critical: [], stalled: [], marginAnomalies: [], discountAnomalies: [] };

  const now = Date.now();
  for (const q of quotes) {
    const daysInactive = (now - new Date(q.updatedAt || q.createdAt).getTime()) / 86400000;
    if (q.dealHealthStatus === "Healthy") buckets.healthy.push(q);
    else if (q.dealHealthStatus === "At Risk") buckets.atRisk.push(q);
    else if (q.dealHealthStatus === "Critical") buckets.critical.push(q);

    if (daysInactive > 7 && !q.confirmedAt) buckets.stalled.push(q);
    if (q.marginPercentage !== null && q.marginPercentage < 0) buckets.marginAnomalies.push(q);
    if (q.weightedDiscountPct > 30) buckets.discountAnomalies.push(q);
  }

  const negotiations = await Negotiation.find({});

  return {
    counts: {
      healthy: buckets.healthy.length,
      atRisk: buckets.atRisk.length,
      critical: buckets.critical.length,
      stalled: buckets.stalled.length,
      marginAnomalies: buckets.marginAnomalies.length,
      discountAnomalies: buckets.discountAnomalies.length,
      activeNegotiations: negotiations.filter((n) => ["Pending", "Counter Offered", "Escalated"].includes(n.status)).length,
      pendingApprovals: await Approval.countDocuments({ status: "Pending" }),
    },
    lists: buckets,
    avgHealth: quotes.length ? Math.round(quotes.reduce((s, q) => s + (q.dealHealthScore || 0), 0) / quotes.length) : 100,
    totalQuotes: quotes.length,
  };
}

export async function dealerIntelligence(settings) {
  const dealers = await Dealer.find({ active: true });
  const offers = await DealerOffer.find({ active: true }).populate("dealerId").populate("productId");
  const quotes = await Quotation.find({}).populate("customerId");

  const rows = dealers.map((d) => {
    const dOffers = offers.filter((o) => String(o.dealerId?._id || o.dealerId) === String(d._id));
    const avgPrice = dOffers.length ? dOffers.reduce((s, o) => s + o.sellingPrice, 0) / dOffers.length : 0;
    const avgDelivery = dOffers.length ? dOffers.reduce((s, o) => s + o.deliveryDays, 0) / dOffers.length : 0;
    const totalInventory = dOffers.reduce((s, o) => s + o.availableQuantity, 0);
    const usedInQuotes = quotes.filter((q) => q.lines.some((l) => String(l.dealerId || "") === String(d._id)));
    const wins = usedInQuotes.filter((q) => q.confirmedAt).length;
    const avgProfit = usedInQuotes.reduce(
      (s, q) => s + q.lines.filter((l) => String(l.dealerId || "") === String(d._id)).reduce((m, l) => m + (l.margin || 0), 0),
      0
    );

    return {
      id: String(d._id),
      name: d.name,
      rating: d.rating,
      reliabilityScore: d.reliabilityScore,
      minimumProfitMargin: d.minimumProfitMargin,
      paymentTerms: d.paymentTerms,
      avgPrice: Math.round(avgPrice),
      avgDelivery: Math.round(avgDelivery * 10) / 10,
      totalInventory,
      activeOffers: dOffers.length,
      dealsInvolved: usedInQuotes.length,
      winRate: usedInQuotes.length ? Math.round((wins / usedInQuotes.length) * 100) : 0,
      derivedProfit: Math.round(avgProfit),
      deliveryPerformance: d.deliveryPerformance || 95,
    };
  });

  const mostCompetitive = rows.length ? rows.reduce((best, r) => (r.avgPrice > 0 && r.avgPrice < best.avgPrice ? r : best), rows[0]) : null;

  const bestPerProduct = [];
  const productIds = [...new Set(offers.map((o) => String(o.productId?._id || o.productId)))];
  for (const pid of productIds) {
    const pOffers = offers.filter((o) => String(o.productId?._id || o.productId) === pid);
    const scored = pOffers
      .map((o) => scoreOffer({ offer: o, requestedPrice: 0, quantity: 1, settings }))
      .sort((a, b) => b.score - a.score);
    if (scored[0]) {
      bestPerProduct.push({
        product: pOffers[0].productId?.name || "Product",
        recommendedDealer: scored[0].dealerName,
        price: scored[0].price,
        deliveryDays: scored[0].deliveryDays,
        reliability: scored[0].reliabilityScore,
        score: scored[0].score,
      });
    }
  }

  return {
    dealers: rows,
    mostCompetitiveDealer: mostCompetitive,
    bestPerProduct,
    totalOffers: offers.length,
    avgDealerCount: productIds.length ? productIds.length / Math.max(1, new Set(offers.map((o) => String(o.dealerId))).size) : 0,
  };
}

export async function recentCustomer(customerId) {
  return Customer.findById(customerId);
}