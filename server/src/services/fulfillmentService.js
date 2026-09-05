import Inventory from "../models/Inventory.js";
import Warehouse from "../models/Warehouse.js";

/**
 * Warehouse fulfillment: distribute each line's quantity across warehouses,
 * prefer a single source, respect availability, produce a backorder plan,
 * and compute shipment count / delivery estimate.
 */
export async function planFulfillment(quote, options = {}) {
  const warehouses = await Warehouse.find({ active: true }).sort({ priority: 1 });
  if (warehouses.length === 0) return { lines: quote.lines, shipments: 0, totalShippingCost: 0, backorders: 0 };

  const plan = [];
  let shipments = 0;
  let totalShippingCost = 0;
  let totalBackorder = 0;

  for (const line of quote.lines) {
    const allocations = [];
    let remaining = line.quantity;
    let shortestDelivery = Infinity;

    for (const wh of warehouses) {
      if (remaining <= 0) break;
      let stock = 0;
      try {
        const inv = await Inventory.findOne({ warehouseId: wh._id, productId: line.productId });
        stock = inv ? Math.max(0, (inv.quantity || 0) - (inv.reservedQuantity || 0)) : 0;
      } catch {
        stock = 0;
      }
      const take = Math.min(remaining, stock);
      if (take > 0) {
        allocations.push({ warehouseId: wh._id, warehouseName: wh.name, location: wh.location, quantity: take });
        remaining -= take;
        shipments += 1;
        totalShippingCost += wh.shippingCostWeight || 0;
        const inv = await Inventory.findOne({ warehouseId: wh._id, productId: line.productId });
        shortestDelivery = Math.min(shortestDelivery, inv?.replenishmentTime || 3);
      }
    }

    const backorder = remaining;
    totalBackorder += backorder;

    if (options.manualOverrides && options.manualOverrides[String(line._id)]) {
      const override = options.manualOverrides[String(line._id)];
      const overrideAllocations = override.allocations || [];
      if (overrideAllocations.length) {
        allocations.length = 0;
        for (const oa of overrideAllocations) {
          allocations.push({
            warehouseId: oa.warehouseId,
            warehouseName: oa.warehouseName,
            location: oa.location || "",
            quantity: oa.quantity,
          });
        }
        totalBackorder -= backorder;
        totalBackorder += Math.max(0, line.quantity - allocations.reduce((s, a) => s + a.quantity, 0));
      }
    }

    plan.push({
      productId: String(line.productId),
      productName: line.productName || "Product",
      quantity: line.quantity,
      available: line.quantity - backorder,
      allocated: allocations,
      backorder,
      deliveryEstimateDays: shortestDelivery === Infinity ? null : shortestDelivery,
      fullyAllocated: backorder === 0,
    });
  }

  return {
    quoteId: String(quote._id),
    quoteNumber: quote.quoteNumber,
    lines: plan,
    shipments,
    totalShippingCost,
    backorders: totalBackorder,
    status: totalBackorder > 0 ? "Partial" : "Planned",
  };
}