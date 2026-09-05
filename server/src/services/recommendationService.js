import Product from "../models/Product.js";
import Concession from "../models/Concession.js";

const CATEGORY_MAP = {
  Hardware: ["Accessories", "Services", "Subscription", "Software"],
  Software: ["Services", "Subscription"],
  Services: ["Subscription"],
  Subscription: ["Services", "Subscription"],
  Accessories: ["Hardware"],
};

const RELATED_NAME_HINTS = [
  ["warranty", "extended"],
  ["laptop", "bag", "case", "dock"],
  ["support", "maintenance", "installation", "setup"],
  ["installation", "service", "setup", "deployment"],
  ["server", "backup", "renewal"],
];

export async function getUpsellRecommendations(baseProductId, quantity, { settings }) {
  const base = await Product.findById(baseProductId);
  if (!base) return [];

  const candidates = await Product.find({
    active: true,
    _id: { $ne: base._id },
    category: { $in: CATEGORY_MAP[base.category] || [] },
  }).limit(8);

  const recommendations = [];
  for (const p of candidates) {
    const unit = p.basePrice;
    const cost = p.costPrice || unit * 0.7;
    const margin = (unit - cost) * quantity;
    const matchReason = nameMatchScore(base.name, p.name);

    recommendations.push({
      product: {
        id: String(p._id),
        name: p.name,
        category: p.category,
        basePrice: unit,
        subscriptionEligible: p.subscriptionEligible,
        unit: p.unit,
      },
      price: unit,
      quantity,
      lineTotal: unit * quantity,
      marginDelta: Math.round(margin),
      customerValue: Math.round(margin),
      matchReason,
      promotion: p.subscriptionEligible ? "First 3 months free" : matchReason,
      theme: base.category === "Hardware" ? "essential" : "growth",
    });
  }

  const concessionImprovement = await Concession.find({ available: true }).limit(3);

  return recommendations.sort((a, b) => b.marginDelta - a.marginDelta).slice(0, 4);
}

function nameMatchScore(baseName, candidateName) {
  const b = baseName.toLowerCase();
  const c = candidateName.toLowerCase();
  for (const hint of RELATED_NAME_HINTS) {
    if (hint.some((w) => b.includes(w)) && hint.some((w) => c.includes(w))) return "frequently bought together";
  }
  return "related to your selection";
}