import Quotation from "../models/Quotation.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import DealerOffer from "../models/DealerOffer.js";
import Settings from "../models/Settings.js";
import Approval from "../models/Approval.js";
import Negotiation from "../models/Negotiation.js";
import Concession from "../models/Concession.js";
import { ApiError } from "../utils/error.js";
import { asyncHandler, deriveStage } from "../utils/helpers.js";
import { verifyVersion } from "../middleware/security.js";
import { recalculateQuote, loadQuoteContext, effectiveDiscountLimit } from "../services/pricingService.js";
import { computeRisk } from "../services/riskService.js";
import { computeDealHealth } from "../services/dealHealthService.js";
import { runApprovals } from "../services/approvalService.js";
import { compareDealersForQuote, scoreOffer } from "../services/dealerService.js";
import { negotiateQuote, applyCounterOfferToQuote } from "../services/negotiationService.js";
import { getUpsellRecommendations } from "../services/recommendationService.js";
import { planFulfillment } from "../services/fulfillmentService.js";
import { buildHybridBilling } from "../services/billingService.js";
import { logAudit, ACTIONS } from "../services/auditService.js";
import { notifyRole } from "../services/notificationService.js";

async function getSettings() {
  let s = await Settings.findOne({ key: "default" });
  if (!s) s = await Settings.create({ key: "default" });
  return s;
}

export async function refreshQuoteIntelligence(quote, opts = {}) {
  const settings = opts.settings || (await getSettings());
  const customer = opts.customer || (await Customer.findById(quote.customerId));
  const ctx = opts.ctx || (await loadQuoteContext(quote));

  await recalculateQuote(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap });
  const risk = computeRisk(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap });
  quote.riskScore = risk.riskScore;
  quote.riskLevel = risk.riskLevel;
  quote.riskReasons = risk.reasons;

  const health = await computeDealHealth(quote, { settings, risk });
  quote.dealHealthScore = health.dealHealthScore;
  quote.dealHealthStatus = health.dealHealthStatus;

  if (opts.save !== false) {
    await quote.save();
  }
  return { quote, settings, customer, ctx, risk, health };
}

export const listQuotes = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === "SALES_REP" && !req.query.all) {
    filter.salesRepId = req.user._id;
  }
  if (req.query.stage) {
    const all = await Quotation.find(filter).populate("customerId").sort({ createdAt: -1 });
    const filtered = all.filter((q) => deriveStage(q) === req.query.stage);
    return res.json({ success: true, quotes: filtered });
  }
  const quotes = await Quotation.find(filter).populate("customerId").sort({ createdAt: -1 });
  res.json({ success: true, quotes });
});

export const getQuote = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id).populate("customerId").populate("salesRepId");
  if (!quote) throw new ApiError(404, "Quote not found");
  const settings = await getSettings();
  const ctx = await loadQuoteContext(quote);
  const { customer } = await Customer.findById(quote.customerId).then((c) => ({ customer: c }));

  const risk = computeRisk(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap });
  const health = await computeDealHealth(quote, { settings, risk });
  const comparison = await compareDealersForQuote(quote, { settings, productMap: ctx.productMap });

  const approvals = await Approval.find({ quoteId: quote._id }).sort({ approvalLevel: 1 });
  const negotiations = await Negotiation.find({ quoteId: quote._id }).sort({ createdAt: -1 });

  const recommendation = await getUpsellRecommendations(
    (quote.lines.find((l) => !l.isSubscription) || quote.lines[0])?.productId,
    quote.lines[0]?.quantity || 1,
    { settings }
  ).catch(() => []);

  quote.riskScore = risk.riskScore;
  quote.riskLevel = risk.riskLevel;
  quote.riskReasons = risk.reasons;

  res.json({
    success: true,
    quote,
    stage: deriveStage(quote),
    risk,
    health,
    dealerComparison: comparison,
    approvals,
    negotiations,
    recommendations: recommendation,
    settings: {
      tierDiscountLimits: settings.tierDiscountLimits,
      categoryDiscountLimits: settings.categoryDiscountLimits,
      approvalThresholds: settings.approvalThresholds,
      minCompanyMarginPct: settings.minCompanyMarginPct,
      dealerMinMarginPct: settings.dealerMinMarginPct,
    },
  });
});

export const createQuote = asyncHandler(async (req, res) => {
  const { customerId, lines, expiresInDays } = req.body;
  if (!customerId) throw new ApiError(400, "customerId is required");
  if (!lines || lines.length === 0) throw new ApiError(400, "At least one line is required");
  const customer = await Customer.findById(customerId);
  if (!customer) throw new ApiError(404, "Customer not found");

  const settings = await getSettings();
  const ctx = await loadQuoteContext({ lines });

  const quoteLines = [];
  for (const item of lines) {
    const product = await Product.findById(item.productId);
    if (!product) throw new ApiError(404, `Product ${item.productId} not found`);
    const offer = item.dealerId ? ctx.offerMap.get(`${item.dealerId}|${product._id}`) : null;

    const allowed = effectiveDiscountLimit(settings, customer, product);
    let unitPrice = item.unitPrice || product.basePrice;
    if (item.discountPct !== undefined && item.discountPct !== null) {
      unitPrice = product.basePrice * (1 - item.discountPct / 100);
    }
    unitPrice = Math.max(0, Math.min(product.basePrice, unitPrice));

    quoteLines.push({
      productId: product._id,
      productName: product.name,
      quantity: item.quantity || 1,
      listUnitPrice: product.basePrice,
      unitPrice,
      dealerId: offer ? offer.dealerId : null,
      taxable: true,
      isSubscription: !!item.isSubscription,
      billingCycle: item.billingCycle || product.subscriptionEligible ? product.category === "Subscription" ? "Monthly" : null : null,
    });
  }

  const quote = await Quotation.create({
    customerId,
    salesRepId: req.user._id,
    lines: quoteLines,
  });
  quote.expiresAt = new Date(Date.now() + (expiresInDays || 14) * 86400000);
  await refreshQuoteIntelligence(quote, { settings, customer, ctx });
  await logAudit({ user: req.user, action: ACTIONS.QUOTE_CREATED, entity: "Quotation", entityId: quote._id, quoteId: quote._id });
  res.status(201).json({ success: true, quote });
});

export const updateQuote = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  const { lines } = req.body;

  const settings = await getSettings();
  const customer = await Customer.findById(quote.customerId);
  const ctx = await loadQuoteContext(quote);
  const changedLines = [];

  if (lines) {
    const productMap = ctx.productMap;
    for (const update of lines) {
      const line = quote.lines.id(update._id);
      if (!line) continue;
      const product = productMap.get(String(line.productId)) || (await Product.findById(line.productId));
      const before = { ...line.toObject() };
      if (update.quantity !== undefined) line.quantity = Math.max(1, Math.round(update.quantity));
      if (update.dealerId !== undefined) {
        line.dealerId = update.dealerId || null;
        changedLines.push(ACTIONS.DEALER_CHANGED);
      }
      if (update.unitPrice !== undefined && update.unitPrice !== null) {
        const price = Math.max(0, Math.min(product?.basePrice || line.unitPrice, Number(update.unitPrice)));
        if (Math.abs(price - line.unitPrice) > 0.001) changedLines.push(ACTIONS.DISCOUNT_CHANGED);
        line.unitPrice = price;
      }
      if (update.discountPct !== undefined && update.discountPct !== null) {
        const pct = Math.max(0, Math.min(100, Number(update.discountPct)));
        const price = (product?.basePrice || line.listUnitPrice || line.unitPrice) * (1 - pct / 100);
        if (Math.abs(price - line.unitPrice) > 0.001) changedLines.push(ACTIONS.DISCOUNT_CHANGED);
        line.unitPrice = price;
      }
      if (update.isSubscription !== undefined) line.isSubscription = update.isSubscription;
      if (update.billingCycle !== undefined) line.billingCycle = update.billingCycle;
      line._before = before;
    }
    quote.version += 1;
    quote.matchedLineBefore = changedLines;
  }
  if (req.body.notes !== undefined) quote.notes = req.body.notes;

  const refreshed = await refreshQuoteIntelligence(quote, { settings, customer, ctx });
  for (const action of changedLines) {
    await logAudit({
      user: req.user,
      action,
      entity: "Quotation",
      entityId: quote._id,
      quoteId: quote._id,
      reason: `${action} via quote editor`,
      newValue: { version: quote.version },
    });
  }
  res.json({ success: true, quote, risk: refreshed.risk, health: refreshed.health });
});

export const addLine = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  const { productId, quantity, discountPct, unitPrice, dealerId, isSubscription, billingCycle } = req.body;
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");
  const customer = await Customer.findById(quote.customerId);
  const settings = await getSettings();
  const allowed = effectiveDiscountLimit(settings, customer, product);
  const listUnitPrice = product.basePrice;

  quote.lines.push({
    productId,
    productName: product.name,
    quantity: quantity || 1,
    listUnitPrice,
    unitPrice: unitPrice || (discountPct != null ? listUnitPrice * (1 - Math.min(discountPct, allowed) / 100) : listUnitPrice),
    dealerId: dealerId || null,
    isSubscription: !!isSubscription || (product.category === "Subscription" && product.subscriptionEligible),
    billingCycle: isSubscription || (product.category === "Subscription" && product.subscriptionEligible) ? billingCycle || "Monthly" : null,
  });
  quote.version += 1;

  await refreshQuoteIntelligence(quote, { settings, customer });
  await logAudit({ user: req.user, action: "LINE_ADDED", entity: "Quotation", entityId: quote._id, quoteId: quote._id, reason: `Added ${product.name}` });
  const rec = await getUpsellRecommendations(productId, quantity || 1, { settings });
  res.status(201).json({ success: true, quote, recommendations: rec });
});

export const removeLine = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.query.expectedVersion);
  const line = quote.lines.id(req.params.lineId);
  if (!line) throw new ApiError(404, "Line not found");
  line.remove();
  quote.version += 1;
  await refreshQuoteIntelligence(quote);
  await logAudit({ user: req.user, action: "LINE_REMOVED", entity: "Quotation", entityId: quote._id, quoteId: quote._id, reason: `Removed ${line.productName}` });
  res.json({ success: true, quote });
});

export const submitQuote = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  const refreshed = await refreshQuoteIntelligence(quote);
  const { settings, risk } = refreshed;
  quote.submittedAt = quote.submittedAt || new Date();
  quote.version += 1;
  await quote.save();

  const result = await runApprovals(quote, { settings, risk, actor: req.user, reason: "Submitted for approval" });
  await logAudit({ user: req.user, action: ACTIONS.APPROVAL_REQUESTED, entity: "Quotation", entityId: quote._id, quoteId: quote._id, reason: `Risk ${risk.riskScore} -> chain ${result.chain.join(" > ") || "auto"}` });
  res.json({ success: true, quote, risk, approvalChain: result.chain, autoApproved: result.autoApproved });
});

export const whatIf = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  const settings = await getSettings();
  const customer = await Customer.findById(quote.customerId);
  const { discountPct, quantity, dealerId, includeConcessions } = req.body;

  const sim = new Quotation({ ...quote.toObject(), _id: undefined });
  sim.isNew = true;
  sim._id = undefined;
  sim.quoteNumber = undefined;
  sim.createdAt = undefined;
  sim.updatedAt = undefined;
  sim.submittedAt = undefined;
  sim.confirmedAt = undefined;
  sim.wonAt = undefined;
  sim.lostAt = undefined;
  sim.negotiationStatus = "None";
  sim.approvalStatus = "Not Required";

  for (const line of sim.lines) {
    if (discountPct !== undefined && line.discountPct !== undefined) {
      const pct = Math.max(0, Math.min(100, Number(discountPct)));
      line.unitPrice = (line.listUnitPrice || line.unitPrice) * (1 - pct / 100);
    }
    if (quantity !== undefined && sim.lines.length === 1) line.quantity = Math.max(1, Math.round(quantity));
    if (dealerId !== undefined) line.dealerId = dealerId || null;
  }

  const refreshed = await refreshQuoteIntelligence(sim, { settings, customer, save: false });

  const currentCtx = await loadQuoteContext(quote);
  const currentRisk = computeRisk(quote, { settings, customer, productMap: currentCtx.productMap, offerMap: currentCtx.offerMap });
  const approval = computeRisk(refreshed.quote, { settings, customer, productMap: refreshed.ctx.productMap, offerMap: refreshed.ctx.offerMap });

  let recommendation = "";
  const autoMax = settings.approvalThresholds?.autoMax ?? 20;
  const simRisk = approval.riskScore;
  if (simRisk > autoMax) {
    const steps = Math.ceil((simRisk - autoMax) / 8);
    const appliedDiscount = discountPct ?? refreshed.quote.lines[0]?.discountPct ?? 0;
    const suggested = Math.max(0, Math.round((appliedDiscount - steps) * 2) / 2);
    recommendation = `Instead of a ${appliedDiscount}% discount (risk ${simRisk}), offer ${suggested}% discount + free installation + priority delivery to preserve margin and stay within the ${autoMax}-point autonomous limit.`;
  }

  await logAudit({ user: req.user, action: ACTIONS.WHAT_IF_RUN, entity: "Quotation", entityId: quote._id, quoteId: quote._id, reason: `Simulated discount ${discountPct}%`, newValue: { simulatedRisk: approval.riskScore, currentRisk: currentRisk.riskScore } });

  res.json({
    success: true,
    current: {
      total: quote.total,
      margin: quote.marginPercentage,
      riskScore: currentRisk.riskScore,
      discount: quote.weightedDiscountPct,
      dealerProfit: quote.lines.reduce((s, l) => s + (l.margin || 0), 0),
      approvalChain: currentRisk.approvalChain,
    },
    simulation: {
      total: refreshed.quote.total,
      margin: refreshed.quote.marginPercentage,
      riskScore: approval.riskScore,
      discount: refreshed.quote.weightedDiscountPct,
      riskLevel: approval.riskLevel,
      approvalChain: approval.approvalChain,
      reasons: approval.reasons,
      marginDelta: +(refreshed.quote.marginPercentage - quote.marginPercentage).toFixed(1),
      riskDelta: approval.riskScore - currentRisk.riskScore,
    },
    recommendation,
  });
});

export const applyConcessions = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  const { concessionIds } = req.body;
  const concessions = await Concession.find({ _id: { $in: concessionIds }, available: true });
  if (!concessions.length) throw new ApiError(400, "No valid concessions supplied");
  const note = concessions.map((c) => `+ ${c.name}`).join(", ");
  quote.notes = quote.notes ? `${quote.notes}\n${note}` : note;
  const SVC = await Concession.find({ name: { $in: concessions.map((c) => c.name) } });
  const customer = await Customer.findById(quote.customerId);
  const settings = await getSettings();
  quote.version += 1;
  await refreshQuoteIntelligence(quote, { settings, customer });
  await logAudit({ user: req.user, action: "CONCESSIONS_APPLIED", entity: "Quotation", entityId: quote._id, quoteId: quote._id, reason: note });
  res.json({ success: true, quote, concessions });
});

export const negotiate = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  const { requestedPrice, discountPct } = req.body;
  const settings = await getSettings();
  const customer = await Customer.findById(quote.customerId);
  const ctx = await loadQuoteContext(quote);

  let target = requestedPrice;
  if (target === undefined && discountPct !== undefined) {
    target = quote.subtotal * (1 - Math.min(Number(discountPct), 100) / 100);
  }
  if (target === undefined) throw new ApiError(400, "requestedPrice or discountPct is required");
  target = Math.max(0, Math.min(Number(target), quote.subtotal));

  const result = await negotiateQuote(quote, target, {
    settings,
    customer,
    productMap: ctx.productMap,
    risk: computeRisk(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap }).riskScore,
  });

  const negotiation = await Negotiation.create({
    quoteId: quote._id,
    customerId: quote.customerId,
    requestedBy: req.body.requestedBy || "SalesRep",
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
    negotiationRound: (await Negotiation.countDocuments({ quoteId: quote._id })) + 1,
    status: result.decision === "AUTO_ACCEPT" ? "Approved" : result.decision === "COUNTER_OFFER" ? "Counter Offered" : result.decision === "ESCALATE" ? "Escalated" : "Rejected",
    decision: result.decision,
    recommendation: result.recommendation,
    reason: result.reason,
    concessions: result.concessions,
    riskScore: result.riskScore,
  });

  quote.requestedPrice = target;
  quote.negotiationStatus = result.decision === "AUTO_ACCEPT" ? "Accepted" : result.decision === "COUNTER_OFFER" ? "Counter Offered" : "Negotiating";
  quote.version += 1;
  await quote.save();

  await logAudit({ user: req.user || {}, action: result.decision === "COUNTER_OFFER" ? ACTIONS.COUNTER_GENERATED : ACTIONS.NEGOTIATION_SUBMITTED, entity: "Negotiation", entityId: negotiation._id, quoteId: quote._id, reason: `Requested ₹${target.toLocaleString("en-IN")} -> ${result.decision}` });

  if (result.decision === "ESCALATE") {
    await notifyRole("SALES_MANAGER", {
      type: "negotiation",
      title: `Quote ${quote.quoteNumber} negotiation requires approval`,
      message: `Customer requested ₹${target.toLocaleString("en-IN")} exceeding the autonomous negotiation limit (${result.reason})`,
      quoteId: quote._id,
    }).catch(() => {});
  }

  res.json({ success: true, negotiation, result });
});

export const acceptCounterOffer = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  const negotiationId = req.body.negotiationId || req.params.negotiationId;
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);

  const settings = await getSettings();
  const customer = await Customer.findById(quote.customerId);
  const ctx = await loadQuoteContext(quote);

  let negotiation;
  if (negotiationId) negotiation = await Negotiation.findById(negotiationId);
  if (!negotiation) {
    negotiation = await Negotiation.findOne({ quoteId: quote._id, status: "Counter Offered" }).sort({ createdAt: -1 });
  }
  if (!negotiation) throw new ApiError(400, "No pending counter-offer found");

  const result = await negotiateQuote(quote, negotiation.proposedPrice || negotiation.customerRequestedPrice, {
    settings,
    customer,
    productMap: ctx.productMap,
  });

  applyCounterOfferToQuote(quote, result);
  quote.negotiationStatus = "Accepted";
  quote.requestedPrice = null;
  quote.version += 1;
  await refreshQuoteIntelligence(quote, { settings, customer, ctx });

  negotiation.status = "Accepted";
  negotiation.proposedPrice = result.proposedPrice;
  await negotiation.save();

  const risk = computeRisk(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap });
  const approvalResult = await runApprovals(quote, { settings, risk, actor: req.user, reason: "Counter-offer accepted" });

  quote.approvalStatus = approvalResult.autoApproved ? "Approved" : "Pending";
  await quote.save();

  await logAudit({ user: req.user, action: "COUNTER_OFFER_ACCEPTED", entity: "Negotiation", entityId: negotiation._id, quoteId: quote._id, reason: `Accepted counter-offer ₹${result.proposedPrice}` });

  res.json({ success: true, quote, negotiation, risk, autoApproved: approvalResult.autoApproved, approvalChain: approvalResult.chain });
});

export const dealerComparison = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  const settings = await getSettings();
  const ctx = await loadQuoteContext(quote);
  const comparison = await compareDealersForQuote(quote, { settings, productMap: ctx.productMap });
  res.json({ success: true, comparison });
});

export const listApprovals = asyncHandler(async (req, res) => {
  const approvals = await Approval.find({ status: "Pending" })
    .populate("quoteId")
    .sort({ createdAt: 1 });
  const view = approvals.filter((a) => a.approverRole === req.user.role || ["ADMIN", "FINANCE"].includes(req.user.role));
  res.json({ success: true, approvals: view });
});

export const reviewApproval = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  const approval = await Approval.findById(id);
  if (!approval) throw new ApiError(404, "Approval not found");
  const quote = await Quotation.findById(approval.quoteId);
  if (!quote) throw new ApiError(404, "Quote not found");
  if (approval.approverRole !== req.user.role && req.user.role !== "ADMIN" && req.user.role !== "FINANCE") {
    throw new ApiError(403, "Not your approval step");
  }
  const result = await resolveApprovalHelper({ approval, quote, status, approver: req.user, reason });
  res.json({ success: true, quote, approval, ...result });
});

async function resolveApprovalHelper({ approval, quote, status, approver, reason }) {
  const { resolveApproval } = await import("../services/approvalService.js");
  return resolveApproval({ approval, quote, status, approver, reason });
}

export const fulfillmentPlan = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  const plan = await planFulfillment(quote, { manualOverrides: req.body?.manualOverrides });
  quote.fulfillmentStatus = plan.status;
  if (plan.status === "Partial") quote.fulfillmentStatus = "Partial";
  quote.version += 1;
  await quote.save();
  await logAudit({ user: req.user, action: ACTIONS.FULFILLMENT_CHANGED, entity: "Quotation", entityId: quote._id, quoteId: quote._id, reason: `Planned ${plan.shipments} shipment(s), backorder ${plan.backorders}` });
  res.json({ success: true, plan });
});

export const billingPreview = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  const billing = await buildHybridBilling(quote);
  res.json({ success: true, billing });
});

export const confirmQuote = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);

  if (quote.approvalStatus === "Pending") throw new ApiError(400, "Quote cannot be confirmed while approval is pending");
  if (quote.approvalStatus === "Rejected") throw new ApiError(400, "Quote was rejected and cannot be confirmed");

  const settings = await getSettings();
  const customer = await Customer.findById(quote.customerId);
  const ctx = await loadQuoteContext(quote);
  const risk = computeRisk(quote, { settings, customer, productMap: ctx.productMap, offerMap: ctx.offerMap });
  if (risk.riskScore > (settings.approvalThresholds?.autoMax ?? 20)) {
    throw new ApiError(400, "Quote requires approval before confirmation");
  }

  quote.confirmedAt = quote.confirmedAt || new Date();
  quote.wonAt = quote.wonAt || new Date();
  quote.fulfillmentStatus = "Pending";
  quote.version += 1;
  await quote.save();

  await logAudit({ user: req.user, action: ACTIONS.QUOTE_WON, entity: "Quotation", entityId: quote._id, quoteId: quote._id, reason: "Deal won" });
  res.json({ success: true, quote });
});

export const markLost = asyncHandler(async (req, res) => {
  const quote = await Quotation.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found");
  verifyVersion(quote, req.body.expectedVersion);
  quote.lostAt = quote.lostAt || new Date();
  quote.version += 1;
  await quote.save();
  res.json({ success: true, quote });
});

export const parseCSVReport = asyncHandler(async (req, res) => {
  const quotes = await Quotation.find({}).populate("customerId");
  res.json({ success: true, quotes });
});