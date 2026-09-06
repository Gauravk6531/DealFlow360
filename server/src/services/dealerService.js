import DealerOffer from "../models/DealerOffer.js";
import Dealer from "../models/Dealer.js";

/**
 * Multi-Dealer Comparison & Scoring.
 * Never just pick the cheapest dealer. Score = weighted combination of
 * customer price competitiveness, dealer profitability, company profitability,
 * delivery speed, inventory coverage, reliability and shipping cost.
 */
export function scoreOffer({ offer, requestedPrice, quantity, settings }) {
  const dealer = offer.dealerId;
  const customerSafePrice = maxOf(
    offer.minimumAcceptablePrice,
    offer.sellingPrice * (1 + (settings.minCompanyMarginPct || 10) / 100)
  );
  const reqPrice =
    requestedPrice > 0
      ? requestedPrice
      : customerSafePrice > 0
        ? customerSafePrice
        : offer.sellingPrice * 1.2;

  // A dealer is "price competitive" when its minimum SAFE customer price is close to (below) the target
  const priceCompetitiveness = clampScaled((reqPrice - customerSafePrice) / (reqPrice || 1));
  const dealerProfit = offer.sellingPrice - offer.dealerCost;
  const dealerProfitability = clampScaled(dealerProfit / (offer.dealerCost || 1));
  const minCompany = offer.sellingPrice * (1 + (settings.minCompanyMarginPct || 10) / 100);
  const companyProfit = reqPrice - minCompany;
  const companyProfitability = clampScaled(companyProfit / (reqPrice || 1));
  const deliveryScore = clampScaled((30 - (offer.deliveryDays || 0)) / 30);
  const inventoryScore = clampScaled((offer.availableQuantity || 0) / (quantity || 1));
  const reliability = (dealer?.reliabilityScore ?? offer.reliabilityScore ?? 80) / 100;
  const shippingScore = clampScaled(1 - (offer.shippingCost || 0) / (reqPrice || 1));

  const weights = {
    priceCompetitiveness: 0.25,
    dealerProfitability: 0.2,
    companyProfitability: 0.2,
    deliveryScore: 0.08,
    inventoryScore: 0.1,
    reliability: 0.12,
    shippingScore: 0.05,
  };

  const total =
    priceCompetitiveness * weights.priceCompetitiveness +
    dealerProfitability * weights.dealerProfitability +
    companyProfitability * weights.companyProfitability +
    deliveryScore * weights.deliveryScore +  
    inventoryScore * weights.inventoryScore +
    reliability * weights.reliability +
    shippingScore * weights.shippingScore;

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const score = (total / totalWeight) * 100;

  return {
    dealerId: String(dealer?._id || offer.dealerId),
    dealerName: dealer?.name || "Unknown",
    price: offer.sellingPrice,
    dealerCost: offer.dealerCost,
    dealerProfit: round(dealerProfit),
    minimumAcceptablePrice: offer.minimumAcceptablePrice,
    customerSafePrice,
    deliveryDays: offer.deliveryDays,
    availableQuantity: offer.availableQuantity,
    reliabilityScore: dealer?.reliabilityScore ?? offer.reliabilityScore ?? 80,
    shippingCost: offer.shippingCost || 0,
    promotionalDiscount: offer.promotionalDiscount || 0,
    score: round(score),
  };
}

export async function getDealerOffersForProducts(productIds) {
  const offers = await DealerOffer.find({
    productId: { $in: productIds },
    active: true,
    $or: [{ validUntil: null }, { validUntil: { $gt: new Date() } }],
  }).populate("dealerId");
  return offers;
}

export async function compareDealersForQuote(quote, { settings, productMap }) {
  const deals = new Map();
  const offers = await getDealerOffersForProducts(quote.lines.map((l) => l.productId));
  for (const o of offers) {
    const pid = String(o.productId);
    if (!deals.has(pid)) deals.set(pid, []);
    deals.get(pid).push(o);
  }

  const perLine = [];
  for (const line of quote.lines) {
    const product = productMap.get(String(line.productId));
    if (!product) continue;
    const offersForProduct = deals.get(String(line.productId)) || [];
    const scored = offersForProduct.map((o) =>
      scoreOffer({ offer: o, requestedPrice: line.unitPrice, quantity: line.quantity, settings })
    );
    scored.sort((a, b) => b.score - a.score);
    perLine.push({
      productId: String(line.productId),
      productName: product.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      dealers: scored,
      recommendedDealerId: scored[0]?.dealerId || null,
      recommendedDealerName: scored[0]?.dealerName || null,
    });
  }

  const dealerWinCount = new Map();
  for (const line of perLine) {
    if (line.recommendedDealerId) {
      dealerWinCount.set(line.recommendedDealerId, (dealerWinCount.get(line.recommendedDealerId) || 0) + 1);
    }
  }

  let bestDealer = "";
  let bestCount = 0;
  for (const [id, count] of dealerWinCount) {
    if (count > bestCount) {
      bestCount = count;
      bestDealer = id;
    }
  }

  return { perLine, bestDealerId: bestDealer, bestDealerName: findName(perLine, bestDealer) };
}

export async function bestDealerForProduct(productId, quantity, settings) {
  const offers = await getDealerOffersForProducts([productId]);
  const scored = offers
    .map((o) => scoreOffer({ offer: o, requestedPrice: 0, quantity, settings }))
    .sort((a, b) => b.score - a.score);
  return scored[0] || null;
}

function findName(perLine, dealerId) {
  for (const line of perLine) {
    const d = line.dealers.find((x) => x.dealerId === dealerId);
    if (d) return d.dealerName;
  }
  return "";
}

function clampScaled(v) {
  return Math.max(0, Math.min(1, v));
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function maxOf(...vals) {
  return Math.max(...vals.filter((v) => typeof v === "number" && !Number.isNaN(v)));
}