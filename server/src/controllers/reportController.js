import Quotation from "../models/Quotation.js";
import Negotiation from "../models/Negotiation.js";
import Dealer from "../models/Dealer.js";
import { asyncHandler, deriveStage } from "../utils/helpers.js";

export const reports = asyncHandler(async (req, res) => {
  const { startDate, endDate, salesRep, customer, dealer, product, category, stage } = req.query;

  const q = {};
  if (startDate || endDate) q.createdAt = {};
  if (startDate) q.createdAt.$gte = new Date(startDate);
  if (endDate) q.createdAt.$lte = new Date(endDate);
  if (salesRep) q.salesRepId = salesRep;
  if (customer) q.customerId = customer;
  if (req.user.role === "SALES_REP") q.salesRepId = req.user._id;

  const quotes = await Quotation.find(q)
    .populate("customerId")
    .populate("salesRepId")
    .sort({ createdAt: -1 });

  let filtered = quotes;
  if (dealer || product || category) {
    filtered = filtered.filter((quote) =>
      quote.lines.some((l) => {
        if (dealer && String(l.dealerId || "") !== String(dealer)) return false;
        if (product && String(l.productId) !== String(product)) return false;
        if (category && l.productCategory !== category) return false;
        return true;
      })
    );
  }
  if (stage) filtered = filtered.filter((quote) => deriveStage(quote) === stage);

  const byStage = {};
  let totalValue = 0;
  let totalMargin = 0;
  let totalDiscount = 0;
  for (const quote of filtered) {
    const st = deriveStage(quote);
    byStage[st] = (byStage[st] || 0) + 1;
    totalValue += quote.total || 0;
    totalMargin += quote.estimatedMargin || 0;
    totalDiscount += quote.discountAmount || 0;
  }

  const won = filtered.filter((q) => q.wonAt);
  const negotiations = await Negotiation.find({
    quoteId: { $in: filtered.map((x) => x._id) },
  });

  const negotiationSuccess = negotiations.length
    ? Math.round((negotiations.filter((n) => n.status === "Accepted" || n.decision === "AUTO_ACCEPT").length / negotiations.length) * 100)
    : 0;

  const dealers = await Dealer.find({});
  const dealerPerformance = dealers.map((d) => {
    const involved = filtered.filter((qu) => qu.lines.some((l) => String(l.dealerId || "") === String(d._id)));
    const dWon = involved.filter((qu) => qu.wonAt).length;
    return {
      dealer: d.name,
      deals: involved.length,
      won: dWon,
      winRate: involved.length ? Math.round((dWon / involved.length) * 100) : 0,
      reliability: d.reliabilityScore,
    };
  });

  res.json({
    success: true,
    report: {
      filteredCount: filtered.length,
      totalValue: Math.round(totalValue),
      totalMargin: Math.round(totalMargin),
      totalDiscount: Math.round(totalDiscount),
      avgMarginPct: totalValue ? Math.round((totalMargin / totalValue) * 100 * 10) / 10 : 0,
      conversionRate: filtered.length ? Math.round((won.length / filtered.length) * 100) : 0,
      wonCount: won.length,
      negotiationSuccess,
      byStage,
      dealerPerformance,
      rows: filtered.map((quote) => ({
        id: String(quote._id),
        quoteNumber: quote.quoteNumber,
        customer: quote.customerId?.name,
        salesRep: quote.salesRepId?.name,
        total: quote.total,
        marginPercentage: quote.marginPercentage,
        discountAmount: quote.discountAmount,
        weightedDiscountPct: quote.weightedDiscountPct,
        approvalStatus: quote.approvalStatus,
        negotiationStatus: quote.negotiationStatus,
        stage: deriveStage(quote),
        createdAt: quote.createdAt,
      })),
    },
  });
});