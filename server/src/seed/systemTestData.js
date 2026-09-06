import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import Dealer from "../models/Dealer.js";
import DealerOffer from "../models/DealerOffer.js";
import Warehouse from "../models/Warehouse.js";
import Inventory from "../models/Inventory.js";
import Quotation from "../models/Quotation.js";
import Negotiation from "../models/Negotiation.js";
import Approval from "../models/Approval.js";
import Subscription from "../models/Subscription.js";

// This dataset is isolated by prefixes and never deletes normal demo data.
dotenv.config();
const PREFIX = "system-test-";
const password = "SystemTest@123";

async function cleanup() {
  const [users, customers, products, dealers, warehouses, testQuotes] = await Promise.all([
    User.find({ email: new RegExp(`^${PREFIX}`) }).select("_id"),
    Customer.find({ email: new RegExp(`^${PREFIX}`) }).select("_id"),
    Product.find({ sku: new RegExp(`^${PREFIX}`, "i") }).select("_id"),
    Dealer.find({ email: new RegExp(`^${PREFIX}`) }).select("_id"),
    Warehouse.find({ name: new RegExp(`^${PREFIX}`) }).select("_id"),
    Quotation.find({ notes: "SYSTEM_TEST" }).select("_id"),
  ]);
  const userIds = users.map((doc) => doc._id);
  const customerIds = customers.map((doc) => doc._id);
  const productIds = products.map((doc) => doc._id);
  const dealerIds = dealers.map((doc) => doc._id);
  const warehouseIds = warehouses.map((doc) => doc._id);
  const quoteIds = testQuotes.map((doc) => doc._id);

  const result = await Promise.all([
    Quotation.deleteMany({ _id: { $in: quoteIds } }),
    Negotiation.deleteMany({ $or: [{ reason: "SYSTEM_TEST" }, { quoteId: { $in: quoteIds } }] }),
    Approval.deleteMany({ $or: [{ reason: "SYSTEM_TEST" }, { quoteId: { $in: quoteIds } }] }),
    Subscription.deleteMany({ name: new RegExp(`^${PREFIX}`) }),
    DealerOffer.deleteMany({ dealerId: { $in: dealerIds } }),
    Inventory.deleteMany({ productId: { $in: productIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
    Customer.deleteMany({ _id: { $in: customerIds } }),
    Product.deleteMany({ _id: { $in: productIds } }),
    Dealer.deleteMany({ _id: { $in: dealerIds } }),
    Warehouse.deleteMany({ _id: { $in: warehouseIds } }),
  ]);
  return result.reduce((sum, item) => sum + (item.deletedCount || 0), 0);
}

async function generate() {
  await cleanup();
  const hashedPassword = await bcrypt.hash(password, 10);

  const users = await User.insertMany(Array.from({ length: 20 }, (_, index) => ({
    name: `System Test ${["Rep", "Manager", "Finance", "Admin"][index % 4]} ${index + 1}`,
    email: `${PREFIX}user-${index + 1}@example.com`,
    password: hashedPassword,
    role: ["SALES_REP", "SALES_MANAGER", "FINANCE", "ADMIN"][index % 4],
    company: "DealFlow360 System Test",
    active: true,
  })));
  const reps = users.filter((user) => user.role === "SALES_REP");
  const managers = users.filter((user) => user.role === "SALES_MANAGER");

  const customers = await Customer.insertMany(Array.from({ length: 40 }, (_, index) => ({
    name: `System Test Customer ${index + 1}`,
    email: `${PREFIX}customer-${index + 1}@example.com`,
    password: hashedPassword,
    company: `System Test Company ${index + 1}`,
    customerTier: ["Bronze", "Silver", "Gold", "Platinum"][index % 4],
    currency: "INR",
    creditLimit: 500000 + index * 25000,
    historicalAverageDiscount: 4 + (index % 13),
    negotiationProfile: { typicalRequestedDiscount: 5 + (index % 10), aggressiveness: 0.3 + (index % 5) / 10, previousWinRate: 0.4 + (index % 5) / 10 },
    active: true,
  })));

  const products = await Product.insertMany(Array.from({ length: 20 }, (_, index) => ({
    name: `System Test Product ${index + 1}`,
    sku: `${PREFIX}sku-${index + 1}`,
    category: ["Hardware", "Software", "Services", "Subscription", "Accessories"][index % 5],
    description: "Realistic medium-volume system test catalog item",
    basePrice: 5000 + index * 2500,
    costPrice: 3500 + index * 1500,
    unit: index % 5 === 2 ? "job" : "unit",
    tax: 18,
    subscriptionEligible: index % 5 === 3,
    active: true,
  })));

  const demoDealers = await Dealer.find({ active: true }).limit(4);
  const demoWarehouses = await Warehouse.find({ active: true }).limit(2);
  if (demoDealers.length < 2 || demoWarehouses.length < 2) throw new Error("Run the normal demo seed first");

  const offers = await DealerOffer.insertMany(products.flatMap((product, index) => [0, 1].map((dealerIndex) => ({
    dealerId: demoDealers[dealerIndex]._id,
    productId: product._id,
    sellingPrice: product.basePrice * (0.82 + dealerIndex * 0.04),
    dealerCost: product.costPrice,
    availableQuantity: 20 + index * 3,
    minimumAcceptablePrice: product.basePrice * 0.78,
    deliveryDays: 2 + dealerIndex + (index % 4),
    shippingCost: 250 + dealerIndex * 100,
    reliabilityScore: 88 + dealerIndex * 5,
    active: true,
  }))));

  await Inventory.insertMany(products.flatMap((product, index) => demoWarehouses.map((warehouse, warehouseIndex) => ({
    warehouseId: warehouse._id,
    productId: product._id,
    quantity: 30 + index * 2 + warehouseIndex * 10,
    reservedQuantity: index % 6,
    reorderLevel: 8,
    replenishmentTime: 3 + warehouseIndex,
  }))));

  const quoteStages = ["Draft", "Sent", "Negotiation", "Approval", "Approved", "Fulfillment", "Billing", "Won", "Lost"];
  const quotes = [];
  for (let index = 0; index < 60; index += 1) {
    const stage = quoteStages[index % quoteStages.length];
    const customer = customers[index % customers.length];
    const rep = reps[index % reps.length];
    const first = products[index % products.length];
    const second = products[(index + 3) % products.length];
    const quantity = index % 10 === 0 ? 100 : (index % 6) + 1;
    const discountPct = index % 9 === 0 ? 15 : index % 3 === 0 ? 8 : 0;
    const firstPrice = first.basePrice * (1 - discountPct / 100);
    const subtotal = firstPrice * quantity + second.basePrice;
    const tax = subtotal * 0.18;
    const quote = {
      quoteNumber: `ST-Q-${String(index + 1).padStart(4, "0")}`,
      customerId: customer._id,
      salesRepId: rep._id,
      lines: [
        { productId: first._id, productName: first.name, quantity, listUnitPrice: first.basePrice, unitPrice: firstPrice, discountPct, taxable: true, isSubscription: first.subscriptionEligible, billingCycle: first.subscriptionEligible ? "Monthly" : null },
        { productId: second._id, productName: second.name, quantity: 1, listUnitPrice: second.basePrice, unitPrice: second.basePrice, discountPct: 0, taxable: true },
      ],
      subtotal,
      discountAmount: first.basePrice * quantity - firstPrice * quantity,
      tax,
      total: subtotal + tax,
      weightedDiscountPct: discountPct,
      riskScore: discountPct >= 15 ? 72 : discountPct >= 8 ? 42 : 8,
      riskLevel: discountPct >= 15 ? "High" : discountPct >= 8 ? "Medium" : "Low",
      approvalStatus: ["Approval", "Rejected"].includes(stage) ? (stage === "Rejected" ? "Rejected" : "Pending") : stage === "Approved" || ["Fulfillment", "Billing", "Won"].includes(stage) ? "Approved" : "Not Required",
      fulfillmentStatus: stage === "Fulfillment" ? "Planned" : stage === "Billing" || stage === "Won" ? "Delivered" : "Pending",
      negotiationStatus: stage === "Negotiation" ? "Counter Offered" : "None",
      submittedAt: ["Draft"].includes(stage) ? null : new Date(Date.now() - (index + 1) * 86400000),
      confirmedAt: ["Fulfillment", "Billing", "Won"].includes(stage) ? new Date(Date.now() - index * 3600000) : null,
      invoiceIssued: ["Billing", "Won"].includes(stage),
      wonAt: stage === "Won" ? new Date(Date.now() - index * 3600000) : null,
      lostAt: stage === "Lost" ? new Date(Date.now() - index * 3600000) : null,
      notes: "SYSTEM_TEST",
    };
    quotes.push(quote);
  }
  const createdQuotes = await Quotation.insertMany(quotes);

  const negotiationQuotes = createdQuotes.filter((_, index) => index % 3 === 0);
  await Negotiation.insertMany(negotiationQuotes.map((quote, index) => ({
    quoteId: quote._id,
    customerId: quote.customerId,
    requestedBy: index % 2 ? "SalesRep" : "Customer",
    originalPrice: quote.subtotal,
    customerRequestedPrice: quote.subtotal * 0.9,
    customerRequestedDiscount: 10,
    proposedPrice: quote.subtotal * 0.94,
    proposedDiscount: 6,
    selectedDealer: offers[index % offers.length].dealerId,
    customerSavings: quote.subtotal * 0.06,
    dealerProfit: quote.subtotal * 0.1,
    companyProfit: quote.subtotal * 0.12,
    negotiationRound: (index % 3) + 1,
    status: ["Counter Offered", "Accepted", "Rejected"][index % 3],
    decision: ["COUNTER_OFFER", "AUTO_ACCEPT", "REJECT"][index % 3],
    reason: "SYSTEM_TEST",
    recommendation: "Maintain dealer floor and company margin",
    riskScore: 25 + index,
  })));

  const approvalQuotes = createdQuotes.filter((_, index) => index % 3 === 1);
  await Approval.insertMany(approvalQuotes.map((quote, index) => ({
    quoteId: quote._id,
    approvalLevel: 1,
    approverRole: index % 2 ? "FINANCE" : "SALES_MANAGER",
    approver: managers[index % managers.length]._id,
    requestedBy: quote.salesRepId,
    status: ["Pending", "Approved", "Rejected"][index % 3],
    reason: "SYSTEM_TEST",
  })));

  await Subscription.insertMany(products.filter((product) => product.subscriptionEligible).map((product, index) => ({
    name: `${PREFIX}subscription-${index + 1}`,
    productId: product._id,
    billingCycle: ["Monthly", "Quarterly", "Yearly"][index % 3],
    price: product.basePrice,
    active: index % 4 !== 3,
  })));

  console.log("System test dataset created successfully");
  console.log("Top-level records: 20 users, 40 customers, 20 products, 40 offers, 40 inventory, 60 quotes, 20 negotiations, 20 approvals, 4 subscriptions = 264");
  console.log("Embedded quote lines: 120");
  console.log(`Generated login: ${PREFIX}user-1@example.com / ${password}`);
}

const action = process.argv[2] || "generate";
connectDB(process.env.MONGO_URI)
  .then(() => (action === "cleanup" ? cleanup().then((count) => console.log(`Removed ${count} system-test records`)) : generate()))
  .catch((error) => {
    console.error("System test data failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
