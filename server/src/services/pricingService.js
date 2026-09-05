import DealerOffer from "../models/DealerOffer.js";
import Product from "../models/Product.js";
import { round2, pct } from "../utils/helpers.js";

/**
 * Money model:
 *  - List price  = product.basePrice (customer reference price before discount)
 *  - DealFlow360 buys each unit from the dealer at offer.sellingPrice  -> company procurement cost
 *  - Dealer profit per unit = offer.sellingPrice - offer.dealerCost (fixed by the offer)
 *  - Company gross margin per line = (unitPrice*qty - discount) - (sellingPrice*qty + shipping)
 */
export async function loadQuoteContext(quote) {
  const products = await Product.find({ _id: { $in: quote.lines.map((l) => l.productId) } });
  const offers = await DealerOffer.find({
    productId: { $in: quote.lines.map((l) => l.productId) },
    active: true,
  }).populate("dealerId");
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const offerMap = new Map();
  for (const o of offers) {
    const key = `${o.dealerId?._id || o.dealerId}|${o.productId}`;
    offerMap.set(key, o);
  }
  return { productMap, offerMap };
}

export function selectOfferForLine(line, offerMap, preferEmptyDealer) {
  if (line.dealerId) {
    const offer = offerMap.get(`${line.dealerId}|${line.productId}`);
    return offer || null;
  }
  return null;
}

export async function recalculateQuote(quote, { settings, customer, productMap, offerMap }) {
  let subtotal = 0;
  let listTotal = 0;
  let totalCost = 0;
  let totalTax = 0;
  let weightedDiscount = 0;
  const taxableTotal = { subtotal: 0, tax: 0 };

  if (!productMap || productMap.size === 0) {
    const ctx = await loadQuoteContext(quote);
    productMap = ctx.productMap;
    offerMap = ctx.offerMap;
  }

  for (const line of quote.lines) {
    const product = productMap.get(String(line.productId));
    if (!product) continue;

    const listUnitPrice = line.listUnitPrice || product.basePrice;
    const unitPrice = typeof line.unitPrice === "number" && line.unitPrice > 0 ? line.unitPrice : listUnitPrice;

    const offer = offerMap.get(`${line.dealerId}|${line.productId}`) || null;
    const procCost = offer ? offer.sellingPrice : product.costPrice || 0;
    const shipping = offer ? offer.shippingCost || 0 : 0;
    const deliveryDays = offer ? offer.deliveryDays || 0 : 0;

    const lineTotal = unitPrice * line.quantity;
    const discount = Math.max(0, (listUnitPrice - unitPrice) * line.quantity);
    const cost = procCost * line.quantity + shipping;
    const margin = lineTotal - discount - cost;
    const marginPct = lineTotal > discount ? pct(margin, lineTotal - discount) : 0;

    const taxRate = line.taxable !== false ? product.tax || 0 : 0;
    const tax = round2((lineTotal - discount) * (taxRate / 100));

    line.listUnitPrice = listUnitPrice;
    line.unitPrice = unitPrice;
    line.discountPct = listUnitPrice > 0 ? pct(listUnitPrice - unitPrice, listUnitPrice) : 0;
    line.discountAmount = discount;
    line.cost = round2(cost);
    line.margin = round2(margin);
    line.marginPct = round2(marginPct);
    line.shippingCost = shipping;
    line.deliveryDays = deliveryDays;
    line.productName = product.name;
    line.tax = product.tax;

    subtotal += lineTotal - discount;
    listTotal += listUnitPrice * line.quantity;
    totalCost += cost;
    totalTax += tax;
    weightedDiscount += (listUnitPrice - unitPrice) * line.quantity;
    taxableTotal.subtotal += lineTotal - discount;
    taxableTotal.tax += tax;
  }

  quote.subtotal = round2(subtotal);
  quote.discountAmount = round2(weightedDiscount);
  quote.tax = round2(totalTax);
  quote.total = round2(subtotal + totalTax);
  quote.estimatedCost = round2(totalCost);
  quote.estimatedMargin = round2(subtotal - totalCost);
  quote.marginPercentage = subtotal > 0 ? round2(pct(subtotal - totalCost, subtotal)) : 0;
  quote.weightedDiscountPct = listTotal > 0 ? round2(pct(weightedDiscount, listTotal)) : 0;
  quote.customerSavings = round2(weightedDiscount);

  return quote;
}

export function effectiveDiscountLimit(settings, customer, product) {
  const tierLimit = (settings.tierDiscountLimits && settings.tierDiscountLimits[customer.customerTier]) ?? Infinity;
  const categoryLimit =
    (settings.categoryDiscountLimits && settings.categoryDiscountLimits[product.category]) ?? Infinity;
  return Math.min(tierLimit, categoryLimit);
}