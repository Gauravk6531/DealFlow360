import Quotation from "../models/Quotation.js";
import Customer from "../models/Customer.js";
import Settings from "../models/Settings.js";
import Negotiation from "../models/Negotiation.js";
import Approval from "../models/Approval.js";
import { ApiError } from "../utils/error.js";
import { asyncHandler } from "../utils/helpers.js";
import { verifyVersion } from "../middleware/security.js";
import { loadQuoteContext, recalculateQuote, effectiveDiscountLimit } from "../services/pricingService.js";
import { computeRisk } from "../services/riskService.js";
import { negotiateQuote, applyCounterOfferToQuote } from "../services/negotiationService.js";
import { logAudit } from "../services/auditService.js";
import { notifyRole } from "../services/notificationService.js";

async function getSettings() {
  let s = await Settings.findOne({ key: "default" });
  if (!s) s = await Settings.create({ key: "default" });
  return s;
}

function sanitizeQuote(quote) {
  const lines = quote.lines.map((l) => ({
    _id: l._id,
    productId: l.productId,
    productName: l.productName,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    listUnitPrice: l.listUnitPrice,
    discountPct: l.discountPct,
    discountAmount: l.discountAmount,
    margin: undefined,
    cost: undefined,
    dealerId: undefined,
    deliveryDays: l.deliveryDays || 0,
    isSubscription: l.isSubscription,
    billingCycle: l.billingCycle,
    taxable: l.taxable,
  }));

  return {
    _id: quote._id,
    quoteNumber: quote.quoteNumber,
    total: quote.total,
    subtotal: quote.subtotal,
    tax: quote.tax,
    discountAmount: quote.discountAmount,
    weightedDiscountPct: quote.weightedDiscountPct,
    negotiationStatus: quote.negotiationStatus,
    fulfillmentStatus: quote.fulfillmentStatus,
    expiresAt: quote.expiresAt,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    notes: quote.notes,
    lines,
    customerSavings: quote.customerSavings,
    customerStatus: "Sent",
  };
}

export const myQuotes = asyncHandler(async (req, res) => {
  const quotes = await Quotation.find({ customerId: req.customer._id })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ success: true, quotes: quotes.map(sanitizeQuote) });
});

export const getQuote = asyncHandler(async (req, res) => {
  const quote = await Quotation.findOne({ _id: req.params.id, customerId: req.customer._id });
  if (!quote) throw new ApiError(404, "Quote not found");

  const settings = await getSettings();
  const customer = await Customer.findById(quote.customerId);
  const ctx = await loadQuoteContext(quote);
  await recalculateQuote(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap });
  const risk = computeRisk(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap });

  const negotiations = await Negotiation.find({ quoteId: quote._id }).sort({ createdAt: -1 });

  // per-line allowed discount ceilings (public policy, not internal)
  const discountLimits = quote.lines
    .map((l) => {
      const product = ctx.productMap.get(String(l.productId));
      if (!product) return null;
      return {
        productId: String(l.productId),
        productName: product.name,
        allowedDiscount: effectiveDiscountLimit(settings, customer, product),
      };
    })
    .filter(Boolean);

  res.json({
    success: true,
    quote: sanitizeQuote(quote),
    discountLimits,
    negotiations: negotiations.map((n) => ({
      id: String(n._id),
      round: n.negotiationRound,
      status: n.status,
      decision: n.decision,
      originalPrice: n.originalPrice,
      customerRequestedPrice: n.customerRequestedPrice,
      customerRequestedDiscount: n.customerRequestedDiscount,
      proposedPrice: n.proposedPrice,
      proposedDiscount: n.proposedDiscount,
      concessions: n.concessions,
      recommendation: n.recommendation,
      reason: n.reason,
      createdAt: n.createdAt,
    })),
  });
});

export const commentLine = asyncHandler(async (req, res) => {
  const { lineId, text } = req.body;
  const quote = await Quotation.findOne({ _id: req.params.id, customerId: req.customer._id });
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  const line = quote.lines.id(lineId);
  if (!line) throw new ApiError(404, "Line item not found");
  line.comment = text;
  quote.version += 1;
  await quote.save();
  res.json({ success: true, quote: sanitizeQuote(quote) });
});

export const requestNegotiation = asyncHandler(async (req, res) => {
  const quote = await Quotation.findOne({ _id: req.params.id, customerId: req.customer._id });
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);

  const settings = await getSettings();
  const customer = await Customer.findById(quote.customerId);
  const ctx = await loadQuoteContext(quote);

  const { requestedPrice, discountPct } = req.body;
  let target = requestedPrice;
  if (target === undefined && discountPct !== undefined) {
    target = quote.subtotal * (1 - Math.min(Number(discountPct), 100) / 100);
  }
  if (target === undefined) throw new ApiError(400, "requestedPrice or discountPct required");
  target = Math.max(0, Math.min(Number(target), quote.subtotal));

  const result = await negotiateQuote(quote, target, { settings, customer, productMap: ctx.productMap });

  const round = (await Negotiation.countDocuments({ quoteId: quote._id })) + 1;
  const negotiation = await Negotiation.create({
    quoteId: quote._id,
    customerId: quote.customerId,
    requestedBy: "Customer",
    originalPrice: result.originalPrice,
    customerRequestedPrice: result.customerRequestedPrice,
    customerRequestedDiscount: result.customerRequestedDiscount,
    proposedPrice: result.proposedPrice,
    proposedDiscount: result.proposedDiscount,
    selectedDealer: result.dealerId,
    dealerOptions: result.dealerOptions,
    customerSavings: result.customerSavings,
    dealerProfit: result.dealerProfit,
    companyProfit: result.companyProfit,
    negotiationRound: round,
    status: result.decision === "AUTO_ACCEPT" ? "Approved" : result.decision === "COUNTER_OFFER" ? "Counter Offered" : result.decision === "ESCALATE" ? "Escalated" : "Rejected",
    decision: result.decision,
    recommendation: result.recommendation,
    reason: result.reason,
    concessions: result.concessions,
  });

  quote.requestedPrice = target;
  quote.negotiationStatus =
    result.decision === "AUTO_ACCEPT" ? "Accepted" : result.decision === "COUNTER_OFFER" ? "Counter Offered" : "Negotiating";
  quote.version += 1;
  await quote.save();

  await logAudit({
    user: null,
    userEmail: req.customer.email,
    action: "NEGOTIATION_SUBMITTED",
    entity: "Negotiation",
    entityId: negotiation._id,
    quoteId: quote._id,
    reason: `Customer requested ₹${target.toLocaleString("en-IN")}`,
  });

  if (result.decision !== "AUTO_ACCEPT") {
    await notifyRole("SALES_REP", {
      type: "negotiation",
      title: `New negotiation request from ${req.customer.name}`,
      message: `Quote ${quote.quoteNumber}: requested ₹${target.toLocaleString("en-IN")}, decision ${result.decision}`,
      quoteId: quote._id,
    }).catch(() => {});
    await notifyRole("SALES_MANAGER", {
      type: "negotiation",
      title: `Customer ${req.customer.name} is negotiating on ${quote.quoteNumber}`,
      message: result.reason,
      quoteId: quote._id,
    }).catch(() => {});
  }

  // Customer-facing response omits all dealer/profit internals
  res.json({
    success: true,
    negotiation: {
      id: String(negotiation._id),
      quoteNumber: quote.quoteNumber,
      status: negotiation.status,
      decision: negotiation.decision,
      originalPrice: result.originalPrice,
      customerRequestedPrice: result.customerRequestedPrice,
      customerRequestedDiscount: result.customerRequestedDiscount,
      proposedPrice: result.proposedPrice,
      proposedDiscount: result.proposedDiscount,
      concessions: result.concessions,
      recommendation: result.recommendation,
      reason: result.reason,
      round,
    },
  });
});

export const acceptCounterOffer = asyncHandler(async (req, res) => {
  const quote = await Quotation.findOne({ _id: req.params.id, customerId: req.customer._id });
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  const negotiationId = req.body.negotiationId || req.params.negotiationId;

  let negotiation;
  if (negotiationId) negotiation = await Negotiation.findOne({ _id: negotiationId, quoteId: quote._id });
  if (!negotiation) {
    negotiation = await Negotiation.findOne({ quoteId: quote._id, status: "Counter Offered" }).sort({ createdAt: -1 });
  }
  if (!negotiation) throw new ApiError(400, "No pending counter-offer found");

  const settings = await getSettings();
  const customer = await Customer.findById(quote.customerId);
  const ctx = await loadQuoteContext(quote);

  const result = await negotiateQuote(quote, negotiation.proposedPrice || negotiation.customerRequestedPrice, {
    settings,
    customer,
    productMap: ctx.productMap,
  });

  applyCounterOfferToQuote(quote, result);
  await recalculateQuote(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap });
  const risk = computeRisk(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap });
  quote.riskScore = risk.riskScore;
  quote.riskLevel = risk.riskLevel;
  quote.riskReasons = risk.reasons;

  negotiation.status = "Accepted";
  await negotiation.save();
  quote.negotiationStatus = "Accepted";
  quote.version += 1;
  await quote.save();

  const { runApprovals } = await import("../services/approvalService.js");
  const approvalResult = await runApprovals(quote, {
    settings,
    risk,
    actor: { _id: null, email: req.customer.email },
    reason: "Customer accepted counter-offer",
  });

  await logAudit({ user: null, userEmail: req.customer.email, action: "COUNTER_OFFER_ACCEPTED", entity: "Negotiation", entityId: negotiation._id, quoteId: quote._id, reason: "Customer accepted counter-offer" });
  await notifyRole("SALES_REP", {
    type: "negotiation",
    title: `${req.customer.name} accepted the counter-offer`,
    message: `Quote ${quote.quoteNumber} accepted${
      approvalResult.autoApproved ? " and auto-approved" : " - pending approval"
    }`,
    quoteId: quote._id,
  }).catch(() => {});

  res.json({
    success: true,
    autoApproved: !!approvalResult.autoApproved,
    pendingApproval: !approvalResult.autoApproved,
    negotiation: {
      id: String(negotiation._id),
      status: "Accepted",
      proposedPrice: negotiation.proposedPrice,
      decision: negotiation.decision,
    },
  });
});

export const confirmQuote = asyncHandler(async (req, res) => {
  const quote = await Quotation.findOne({ _id: req.params.id, customerId: req.customer._id });
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  if (quote.approvalStatus === "Pending") throw new ApiError(400, "Quote is under internal review. You will be notified once confirmed.");
  quote.confirmedAt = quote.confirmedAt || new Date();
  quote.wonAt = quote.wonAt || new Date();
  quote.version += 1;
  await quote.save();
  await logAudit({ user: null, userEmail: req.customer.email, action: "CUSTOMER_CONFIRMED", entity: "Quotation", entityId: quote._id, quoteId: quote._id, reason: "Customer confirmed quotation" });
  res.json({ success: true, quote: sanitizeQuote(quote) });
});

export const portalDashboard = asyncHandler(async (req, res) => {
  const quotes = await Quotation.find({ customerId: req.customer._id }).sort({ createdAt: -1 });
  const open = quotes.filter((q) => !q.confirmedAt && !q.lostAt);
  const accepted = quotes.filter((q) => q.confirmedAt);
  res.json({
    success: true,
    stats: {
      openQuotes: open.length,
      totalValue: Math.round(quotes.reduce((s, q) => s + (q.total || 0), 0)),
      acceptedValue: Math.round(accepted.reduce((s, q) => s + (q.total || 0), 0)),
      averageSavings: quotes.length ? Math.round(quotes.reduce((s, q) => s + (q.customerSavings || 0), 0) / quotes.length) : 0,
    },
    recentQuotes: quotes.slice(0, 5).map(sanitizeQuote),
  });
});