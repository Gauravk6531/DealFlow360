import Subscription from "../models/Subscription.js";
import Product from "../models/Product.js";

/**
 * Hybrid billing: a single order can mix one-time and recurring items.
 * Produces a one-time invoice + a recurring billing schedule that honors
 * proration / cancellation / refund rules from the subscription plan.
 */
export async function buildHybridBilling(quote) {
  const oneTime = [];
  const recurring = [];

  for (const line of quote.lines) {
    if (line.isSubscription && line.billingCycle) {
      recurring.push({
        productId: String(line.productId),
        productName: line.productName || "Subscription",
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        cyclePrice: line.unitPrice * line.quantity,
        billingCycle: line.billingCycle,
        taxable: line.taxable !== false,
      });
    } else {
      oneTime.push({
        productId: String(line.productId),
        productName: line.productName || "Product",
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.unitPrice * line.quantity,
        discountAmount: line.discountAmount || 0,
        shippingCost: line.shippingCost || 0,
        cost: line.cost,
        margin: line.margin,
      });
    }
  }

  const oneTimeSubtotal = oneTime.reduce((s, l) => s + l.lineTotal, 0);
  const recurringMonthlyEquivalent = recurring.reduce((s, l) => {
    const periodicity = l.billingCycle === "Monthly" ? 1 : l.billingCycle === "Quarterly" ? 3 : 12;
    return s + (l.cyclePrice / periodicity);
  }, 0);

  const subscriptionPlans = await Subscription.find({ active: true });

  const invoice = {
    invoiceNumber: `INV-${quote.quoteNumber.replace("Q-", "")}`,
    quoteId: String(quote._id),
    quoteNumber: quote.quoteNumber,
    customerId: String(quote.customerId),
    total: 0,
    subtotal: 0,
    tax: 0,
    currency: "INR",
    items: oneTime,
    type: "ONE_TIME",
  };

  for (const item of oneTime) {
    invoice.subtotal += item.lineTotal;
    if (item.discountAmount) invoice.subtotal -= item.discountAmount;
    invoice.total += item.lineTotal;
    if (item.shippingCost) invoice.total += item.shippingCost;
  }

  const schedule = recurring.map((line) => {
    const plan = subscriptionPlans.find(
      (s) => s.billingCycle === line.billingCycle && (String(s.productId) === line.productId || s.name === line.productName)
    );
    return {
      productName: line.productName,
      billingCycle: line.billingCycle,
      periodPrice: line.cyclePrice,
      prorationRule: plan?.prorationRule || "Daily proration on mid-cycle changes",
      cancellationRule: plan?.cancellationRule || "30-day notice, paid period honored",
      refundRule: plan?.refundRule || "Unused period refunded pro-rata",
      periods: generateSchedule(line.billingCycle, line.cyclePrice, 12),
    };
  });
  schedule.forEach((s) => {
    for (const p of s.periods) {
      p.status = "scheduled";
    }
  });

  return {
    quoteId: String(quote._id),
    quoteNumber: quote.quoteNumber,
    oneTimeInvoice: invoice,
    recurring: schedule,
    recurringMonthlyEquivalent: Math.round(recurringMonthlyEquivalent),
    billingType: recurring.length ? "HYBRID" : "ONE_TIME",
  };
}

function generateSchedule(cycle, price, count) {
  const intervals = { Monthly: 1, Quarterly: 3, Yearly: 12 };
  const months = intervals[cycle] || 1;
  const periods = [];
  const start = new Date();
  for (let i = 0; i < count; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + months * i);
    periods.push({
      period: `${cycle} #${i + 1}`,
      dueDate: due.toISOString().slice(0, 10),
      amount: price,
    });
  }
  return periods;
}