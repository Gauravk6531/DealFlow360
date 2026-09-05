import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import Dealer from "../models/Dealer.js";
import DealerOffer from "../models/DealerOffer.js";
import Warehouse from "../models/Warehouse.js";
import Inventory from "../models/Inventory.js";
import Subscription from "../models/Subscription.js";
import Concession from "../models/Concession.js";
import { ApiError } from "../utils/error.js";
import { asyncHandler } from "../utils/helpers.js";
import { logAudit } from "../services/auditService.js";

const modelFor = {
  products: Product,
  customers: Customer,
  dealers: Dealer,
  offers: DealerOffer,
  warehouses: Warehouse,
  inventory: Inventory,
  subscriptions: Subscription,
  concessions: Concession,
};

export const list = asyncHandler(async (req, res) => {
  const type = req.params.type;
  const M = modelFor[type];
  if (!M) throw new ApiError(400, "Unknown resource type");
  const filter = { ...(req.query.filter ? JSON.parse(req.query.filter) : {}) };
  const docs = await M.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, [type]: docs });
});

export const getOne = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const M = modelFor[type];
  if (!M) throw new ApiError(400, "Unknown resource type");
  const doc = await M.findById(id);
  if (!doc) throw new ApiError(404, "Not found");
  res.json({ success: true, doc });
});

export const create = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const M = modelFor[type];
  if (!M) throw new ApiError(400, "Unknown resource type");

  if (type === "customers" && req.body.password) {
    const existing = await Customer.findOne({ email: req.body.email });
    if (existing) throw new ApiError(400, "Customer email already exists");
  }

  const doc = await M.create(req.body);
  await logAudit({
    user: req.user,
    action: `${type.slice(0, -1).toUpperCase()}_CREATED`,
    entity: type,
    entityId: doc._id,
    reason: "Admin created record",
  });
  res.status(201).json({ success: true, doc });
});

export const update = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const M = modelFor[type];
  if (!M) throw new ApiError(400, "Unknown resource type");
  const doc = await M.findById(id);
  if (!doc) throw new ApiError(404, "Not found");
  const before = doc.toObject();
  Object.assign(doc, req.body);
  await doc.save();
  await logAudit({
    user: req.user,
    action: `${type.slice(0, -1).toUpperCase()}_UPDATED`,
    entity: type,
    entityId: doc._id,
    oldValue: before,
    newValue: doc.toObject(),
    reason: "Admin updated record",
  });
  res.json({ success: true, doc });
});

export const remove = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const M = modelFor[type];
  if (!M) throw new ApiError(400, "Unknown resource type");
  const doc = await M.findById(id);
  if (!doc) throw new ApiError(404, "Not found");
  await M.findByIdAndDelete(id);
  res.json({ success: true, message: "Deleted" });
});

export const dealerOffers = asyncHandler(async (req, res) => {
  const offers = await DealerOffer.find({ dealerId: req.params.id }).populate("productId");
  res.json({ success: true, offers });
});