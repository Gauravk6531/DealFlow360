import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import Dealer from "../models/Dealer.js";
import DealerOffer from "../models/DealerOffer.js";
import Warehouse from "../models/Warehouse.js";
import Inventory from "../models/Inventory.js";
import Subscription from "../models/Subscription.js";
import Concession from "../models/Concession.js";
import Quotation from "../models/Quotation.js";
import Approval from "../models/Approval.js";
import Negotiation from "../models/Negotiation.js";
import Settings from "../models/Settings.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import { recalculateQuote, loadQuoteContext } from "../services/pricingService.js";
import { computeRisk } from "../services/riskService.js";
import { computeDealHealth } from "../services/dealHealthService.js";
import { runApprovals } from "../services/approvalService.js";

dotenv.config();

const models = [
  User, Customer, Product, Dealer, DealerOffer, Warehouse, Inventory,
  Subscription, Concession, Quotation, Approval, Negotiation, Settings, Notification, AuditLog,
];

async function clearAll() {
  for (const m of models) await m.deleteMany({});
  console.log("Cleared all collections");
}

async function seed() {
  await connectDB(process.env.MONGO_URI);
  await clearAll();

  // ---------- Settings (governance policy) ----------
  const settings = await Settings.create({ key: "default" });

  // ---------- Users ----------
  const [admin, rep, manager, finance] = await Promise.all(
    [
      { name: "Aarav Sharma", email: "admin@dealflow360.com", password: "Admin@123", role: "ADMIN", company: "DealFlow360" },
      { name: "Priya Nair", email: "rep@dealflow360.com", password: "Rep@123", role: "SALES_REP", company: "DealFlow360" },
      { name: "Rohan Mehta", email: "manager@dealflow360.com", password: "Manager@123", role: "SALES_MANAGER", company: "DealFlow360" },
      { name: "Sneha Kapoor", email: "finance@dealflow360.com", password: "Finance@123", role: "FINANCE", company: "DealFlow360" },
    ].map((u) => User.create(u))
  );
  console.log("Users seeded");

  // ---------- Customers (portal logins enabled) ----------
  const [acme, beta, nova, zenith] = await Promise.all(
    [
      {
        name: "Acme Corporation", email: "acme@acme.com", password: "Acme@123", company: "Acme Corporation",
        customerTier: "Gold", currency: "INR", creditLimit: 5000000, historicalAverageDiscount: 12,
        preferredProducts: [],
        negotiationProfile: { typicalRequestedDiscount: 12, aggressiveness: 0.7, previousWinRate: 0.6 },
      },
      {
        name: "Beta Industries", email: "beta@beta.com", password: "Beta@123", company: "Beta Industries",
        customerTier: "Silver", currency: "INR", creditLimit: 2000000, historicalAverageDiscount: 8,
        negotiationProfile: { typicalRequestedDiscount: 8, aggressiveness: 0.5, previousWinRate: 0.5 },
      },
      {
        name: "Nova Systems", email: "nova@nova.com", password: "Nova@123", company: "Nova Systems",
        customerTier: "Platinum", currency: "INR", creditLimit: 10000000, historicalAverageDiscount: 15,
        negotiationProfile: { typicalRequestedDiscount: 12, aggressiveness: 0.4, previousWinRate: 0.7 },
      },
      {
        name: "Zenith Ltd", email: "zenith@zenith.com", password: "Zenith@123", company: "Zenith Ltd",
        customerTier: "Bronze", currency: "INR", creditLimit: 500000, historicalAverageDiscount: 4,
        negotiationProfile: { typicalRequestedDiscount: 5, aggressiveness: 0.3, previousWinRate: 0.4 },
      },
    ].map((c) => Customer.create(c))
  );
  console.log("Customers seeded");

  // ---------- Products ----------
  const [laptop, monitor, server, router, installation, premiumSupport, warranty, laptopBag] = await Product.insertMany([
    { name: "Business Laptop", sku: "HWLAPTOP01", category: "Hardware", description: "14\" business laptop, i7 / 16GB / 512GB", basePrice: 50000, costPrice: 40000, unit: "unit", tax: 18, subscriptionEligible: false },
    { name: "Monitor 24", sku: "HWMONITOR01", category: "Hardware", description: "24 inch FHD monitor", basePrice: 15000, costPrice: 11000, unit: "unit", tax: 18, subscriptionEligible: false },
    { name: "Rack Server", sku: "HWSERVER01", category: "Hardware", description: "2U rack server, dual Xeon, 64GB", basePrice: 250000, costPrice: 190000, unit: "unit", tax: 18, subscriptionEligible: false },
    { name: "Enterprise Router", sku: "HWROUTER01", category: "Hardware", description: "Enterprise edge router, 10GbE", basePrice: 40000, costPrice: 30000, unit: "unit", tax: 18, subscriptionEligible: false },
    { name: "Installation Service", sku: "SVCINSTALL01", category: "Services", description: "On-site installation and setup", basePrice: 5000, costPrice: 2000, unit: "job", tax: 18, subscriptionEligible: false },
    { name: "Premium Support", sku: "SUBPREM01", category: "Subscription", description: "Premium 24x7 support subscription", basePrice: 2000, costPrice: 800, unit: "month", tax: 18, subscriptionEligible: true },
    { name: "Extended Warranty", sku: "ACCWARR01", category: "Accessories", description: "2-year extended hardware warranty", basePrice: 8000, costPrice: 3000, unit: "unit", tax: 18, subscriptionEligible: false },
    { name: "Laptop Bag", sku: "ACCBAG01", category: "Accessories", description: "Premium business laptop bag", basePrice: 1500, costPrice: 600, unit: "unit", tax: 18, subscriptionEligible: false },
  ]);
  console.log("Products seeded");

  // ---------- Dealers ----------
  const [techSource, globalDevices, primeDist, nextGen] = await Dealer.insertMany([
    { name: "TechSource", email: "sales@techsource.in", contact: "+91 98100 10001", rating: 4.3, reliabilityScore: 90, minimumProfitMargin: 8, preferredCategories: ["Hardware", "Accessories"], paymentTerms: "Net 30", deliveryPerformance: 96 },
    { name: "Global Devices", email: "sales@globaldevices.in", contact: "+91 98100 10002", rating: 4.7, reliabilityScore: 98, minimumProfitMargin: 8, preferredCategories: ["Hardware", "Subscription"], paymentTerms: "Net 15", deliveryPerformance: 98 },
    { name: "Prime Distribution", email: "sales@primedist.in", contact: "+91 98100 10003", rating: 4.1, reliabilityScore: 86, minimumProfitMargin: 8, preferredCategories: ["Hardware"], paymentTerms: "Net 45", deliveryPerformance: 89 },
    { name: "NextGen Supplies", email: "sales@nextgen.in", contact: "+91 98100 10004", rating: 4.4, reliabilityScore: 90, minimumProfitMargin: 8, preferredCategories: ["Hardware", "Services"], paymentTerms: "Net 30", deliveryPerformance: 93 },
  ]);
  console.log("Dealers seeded");

  // ---------- Dealer offers (HERO DATA: Business Laptop) ----------
  await DealerOffer.insertMany([
    // Business Laptop — Dealer A/B/C/D with distinct economics that make the demo story work
    { dealerId: techSource._id, productId: laptop._id, sellingPrice: 39500, dealerCost: 36300, availableQuantity: 120, minimumAcceptablePrice: 46500, deliveryDays: 2, shippingCost: 0, reliabilityScore: 92, validFrom: null, validUntil: null, active: true },
    { dealerId: globalDevices._id, productId: laptop._id, sellingPrice: 40000, dealerCost: 36500, availableQuantity: 150, minimumAcceptablePrice: 46000, deliveryDays: 4, shippingCost: 0, reliabilityScore: 96, validFrom: null, validUntil: null, active: true },
    { dealerId: primeDist._id, productId: laptop._id, sellingPrice: 38800, dealerCost: 35400, availableQuantity: 40, minimumAcceptablePrice: 47500, deliveryDays: 6, shippingCost: 0, reliabilityScore: 87, validFrom: null, validUntil: null, active: true },
    { dealerId: nextGen._id, productId: laptop._id, sellingPrice: 40500, dealerCost: 37200, availableQuantity: 90, minimumAcceptablePrice: 46500, deliveryDays: 3, shippingCost: 0, reliabilityScore: 90, validFrom: null, validUntil: null, active: true },

    // Monitor 24
    { dealerId: techSource._id, productId: monitor._id, sellingPrice: 11800, dealerCost: 10500, availableQuantity: 40, minimumAcceptablePrice: 13200, deliveryDays: 2, shippingCost: 0, reliabilityScore: 90 },
    { dealerId: globalDevices._id, productId: monitor._id, sellingPrice: 12000, dealerCost: 10700, availableQuantity: 60, minimumAcceptablePrice: 13600, deliveryDays: 4, shippingCost: 0, reliabilityScore: 95 },
    { dealerId: primeDist._id, productId: monitor._id, sellingPrice: 11500, dealerCost: 10200, availableQuantity: 25, minimumAcceptablePrice: 13000, deliveryDays: 6, shippingCost: 0, reliabilityScore: 85 },
    { dealerId: nextGen._id, productId: monitor._id, sellingPrice: 12300, dealerCost: 11000, availableQuantity: 50, minimumAcceptablePrice: 13800, deliveryDays: 3, shippingCost: 0, reliabilityScore: 90 },

    // Rack Server
    { dealerId: techSource._id, productId: server._id, sellingPrice: 210000, dealerCost: 185000, availableQuantity: 5, minimumAcceptablePrice: 232000, deliveryDays: 4, shippingCost: 0, reliabilityScore: 90 },
    { dealerId: globalDevices._id, productId: server._id, sellingPrice: 205000, dealerCost: 182000, availableQuantity: 8, minimumAcceptablePrice: 226000, deliveryDays: 5, shippingCost: 0, reliabilityScore: 96 },
    { dealerId: primeDist._id, productId: server._id, sellingPrice: 218000, dealerCost: 192000, availableQuantity: 3, minimumAcceptablePrice: 240000, deliveryDays: 7, shippingCost: 0, reliabilityScore: 86 },
    { dealerId: nextGen._id, productId: server._id, sellingPrice: 200000, dealerCost: 178000, availableQuantity: 6, minimumAcceptablePrice: 224000, deliveryDays: 6, shippingCost: 0, reliabilityScore: 90 },

    // Enterprise Router
    { dealerId: techSource._id, productId: router._id, sellingPrice: 33000, dealerCost: 29000, availableQuantity: 20, minimumAcceptablePrice: 37000, deliveryDays: 2, shippingCost: 0, reliabilityScore: 90 },
    { dealerId: globalDevices._id, productId: router._id, sellingPrice: 34000, dealerCost: 30000, availableQuantity: 30, minimumAcceptablePrice: 38000, deliveryDays: 4, shippingCost: 0, reliabilityScore: 95 },
    { dealerId: primeDist._id, productId: router._id, sellingPrice: 32500, dealerCost: 28500, availableQuantity: 12, minimumAcceptablePrice: 36500, deliveryDays: 5, shippingCost: 0, reliabilityScore: 86 },
    { dealerId: nextGen._id, productId: router._id, sellingPrice: 34500, dealerCost: 30500, availableQuantity: 25, minimumAcceptablePrice: 38500, deliveryDays: 3, shippingCost: 0, reliabilityScore: 90 },
  ]);
  console.log("Dealer offers seeded");

  // ---------- Warehouses + Inventory ----------
  const [mainWH, eastDepot, westWH] = await Warehouse.insertMany([
    { name: "Main Warehouse", location: "Mumbai", shippingCostWeight: 1, priority: 1 },
    { name: "East Depot", location: "Kolkata", shippingCostWeight: 2, priority: 2 },
    { name: "West Warehouse", location: "Ahmedabad", shippingCostWeight: 1.5, priority: 3 },
  ]);

  const invRows = [
    [mainWH, laptop._id, 15], [eastDepot, laptop._id, 10], [westWH, laptop._id, 8],
    [mainWH, monitor._id, 30], [eastDepot, monitor._id, 5], [westWH, monitor._id, 10],
    [mainWH, server._id, 2], [westWH, server._id, 3],
    [eastDepot, router._id, 15], [westWH, router._id, 5],
    [mainWH, warranty._id, 50], [eastDepot, warranty._id, 10],
    [mainWH, laptopBag._id, 60], [eastDepot, laptopBag._id, 20],
  ];
  await Inventory.insertMany(
    invRows.map(([wh, pid, qty]) => ({ warehouseId: wh._id, productId: pid, quantity: qty, reservedQuantity: 0, reorderLevel: 5, replenishmentTime: 3 }))
  );
  console.log("Warehouses + inventory seeded");

  // ---------- Subscriptions ----------
  const [basicSub, premiumSub, enterpriseSub] = await Subscription.insertMany([
    { name: "Basic Support", productId: null, billingCycle: "Monthly", price: 1000, prorationRule: "Daily proration on mid-cycle changes", cancellationRule: "30-day notice, paid period honored", refundRule: "Unused period refunded pro-rata" },
    { name: "Premium Support", productId: premiumSupport._id, billingCycle: "Monthly", price: 2000, prorationRule: "Daily proration on mid-cycle changes", cancellationRule: "30-day notice, paid period honored", refundRule: "Unused period refunded pro-rata" },
    { name: "Enterprise Support", productId: null, billingCycle: "Monthly", price: 15000, prorationRule: "Daily proration on mid-cycle changes", cancellationRule: "30-day notice, paid period honored", refundRule: "Unused period refunded pro-rata" },
  ]);
  console.log("Subscriptions seeded");

  // ---------- Concessions (non-price negotiation levers) ----------
  await Concession.insertMany([
    { name: "Free Installation", perceivedValue: 15000, companyCost: 2000, dealerCost: 0, category: "Service", available: true },
    { name: "Priority Delivery", perceivedValue: 12000, companyCost: 1500, dealerCost: 0, category: "Delivery", available: true },
    { name: "Extended Warranty Upgrade", perceivedValue: 15000, companyCost: 5000, dealerCost: 0, category: "Warranty", available: true },
    { name: "Free Onboarding", perceivedValue: 10000, companyCost: 3000, dealerCost: 0, category: "Service", available: true },
    { name: "Training Session", perceivedValue: 8000, companyCost: 3000, dealerCost: 0, category: "Support", available: true },
    { name: "Additional Support Hours", perceivedValue: 6000, companyCost: 1500, dealerCost: 0, category: "Support", available: true },
  ]);
  console.log("Concessions seeded");

  // ---------- HERO QUOTE: Acme Corp, 20 Business Laptops ----------
  const heroQuote = await Quotation.create({
    customerId: acme._id,
    salesRepId: rep._id,
    lines: [
      {
        productId: laptop._id,
        productName: laptop.name,
        quantity: 20,
        listUnitPrice: 50000,
        unitPrice: 50000,
        dealerId: globalDevices._id,
        taxable: true,
        isSubscription: false,
      },
    ],
    expiresAt: new Date(Date.now() + 14 * 86400000),
    submittedAt: new Date(),
  });

  let ctx = await loadQuoteContext(heroQuote);
  await recalculateQuote(heroQuote, { settings, customer: acme, productMap: ctx.productMap, offerMap: ctx.offerMap });
  let risk = computeRisk(heroQuote, { settings, customer: acme, productMap: ctx.productMap, offerMap: ctx.offerMap });
  heroQuote.riskScore = risk.riskScore;
  heroQuote.riskLevel = risk.riskLevel;
  heroQuote.riskReasons = risk.reasons;
  const heroHealth = await computeDealHealth(heroQuote, { settings, risk });
  heroQuote.dealHealthScore = heroHealth.dealHealthScore;
  heroQuote.dealHealthStatus = heroHealth.dealHealthStatus;
  await heroQuote.save();
  await runApprovals(heroQuote, { settings, risk, actor: rep, reason: "Seeded hero quote" });

  // Seed the hero counter-offer negotiation (Customer: "I can pay ₹9 lakh")
  const heroNegotiation = await Negotiation.create({
    quoteId: heroQuote._id,
    customerId: acme._id,
    requestedBy: "Customer",
    originalPrice: 1000000,
    customerRequestedPrice: 900000,
    customerRequestedDiscount: 10,
    proposedPrice: 920000,
    proposedDiscount: 8,
    selectedDealer: globalDevices._id,
    dealerOptions: [],
    customerSavings: 80000,
    dealerProfit: 60000,
    companyProfit: 120000,
    negotiationRound: 1,
    status: "Counter Offered",
    decision: "COUNTER_OFFER",
    recommendation: "Counter-offer ₹9,20,000 plus negotiated concessions: Free Installation, Priority Delivery.",
    reason: "Requested price would violate a dealer minimum margin. A slightly higher price plus value-added concessions keeps everyone profitable.",
    concessions: ["Free Installation", "Priority Delivery"],
  });
  heroQuote.negotiationStatus = "Counter Offered";
  heroQuote.requestedPrice = 900000;
  await heroQuote.save();
  console.log("Hero quote + negotiation seeded:", heroQuote.quoteNumber);

  // ---------- BETA: needs manager approval (12% > Silver 10%) ----------
  const betaQuote = await Quotation.create({
    customerId: beta._id,
    salesRepId: rep._id,
    lines: [
      {
        productId: laptop._id,
        productName: laptop.name,
        quantity: 10,
        listUnitPrice: 50000,
        unitPrice: 50000 * (1 - 0.12),
        dealerId: techSource._id,
        taxable: true,
      },
    ],
    expiresAt: new Date(Date.now() + 10 * 86400000),
    submittedAt: new Date(),
  });
  ctx = await loadQuoteContext(betaQuote);
  await recalculateQuote(betaQuote, { settings, customer: beta, productMap: ctx.productMap, offerMap: ctx.offerMap });
  risk = computeRisk(betaQuote, { settings, customer: beta, productMap: ctx.productMap, offerMap: ctx.offerMap });
  betaQuote.riskScore = risk.riskScore;
  betaQuote.riskLevel = risk.riskLevel;
  betaQuote.riskReasons = risk.reasons;
  const betaHealth = await computeDealHealth(betaQuote, { settings, risk });
  betaQuote.dealHealthScore = betaHealth.dealHealthScore;
  betaQuote.dealHealthStatus = betaHealth.dealHealthStatus;
  await betaQuote.save();
  await runApprovals(betaQuote, { settings, risk, actor: rep, reason: "12% discount exceeds Silver ceiling" });
  console.log("Beta quote seeded (pending approval, risk", risk.riskScore + ")");

  // ---------- NOVA: won deal ----------
  const novaQuote = await Quotation.create({
    customerId: nova._id,
    salesRepId: rep._id,
    lines: [
      {
        productId: server._id,
        productName: server.name,
        quantity: 5,
        listUnitPrice: 250000,
        unitPrice: 230000,
        dealerId: globalDevices._id,
        taxable: true,
      },
      {
        productId: installation._id,
        productName: installation.name,
        quantity: 5,
        listUnitPrice: 5000,
        unitPrice: 5000,
        dealerId: null,
        taxable: true,
      },
    ],
    expiresAt: new Date(Date.now() + 21 * 86400000),
    submittedAt: new Date(Date.now() - 20 * 86400000),
    confirmedAt: new Date(Date.now() - 15 * 86400000),
    wonAt: new Date(Date.now() - 15 * 86400000),
    invoiceIssued: true,
    approvalStatus: "Approved",
    fulfillmentStatus: "Delivered",
    negotiationStatus: "None",
  });
  ctx = await loadQuoteContext(novaQuote);
  await recalculateQuote(novaQuote, { settings, customer: nova, productMap: ctx.productMap, offerMap: ctx.offerMap });
  risk = computeRisk(novaQuote, { settings, customer: nova, productMap: ctx.productMap, offerMap: ctx.offerMap });
  novaQuote.riskScore = risk.riskScore;
  novaQuote.riskLevel = risk.riskLevel;
  novaQuote.riskReasons = risk.reasons;
  const novaHealth = await computeDealHealth(novaQuote, { settings, risk });
  novaQuote.dealHealthScore = novaHealth.dealHealthScore;
  novaQuote.dealHealthStatus = novaHealth.dealHealthStatus;
  await novaQuote.save();
  console.log("Nova won quote seeded:", novaQuote.quoteNumber);

  // ---------- ZENITH: draft ----------
  const zenithQuote = await Quotation.create({
    customerId: zenith._id,
    salesRepId: rep._id,
    lines: [
      {
        productId: monitor._id,
        productName: monitor.name,
        quantity: 8,
        listUnitPrice: 15000,
        unitPrice: 15000,
        dealerId: primeDist._id,
        taxable: true,
      },
    ],
    expiresAt: new Date(Date.now() + 14 * 86400000),
  });
  ctx = await loadQuoteContext(zenithQuote);
  await recalculateQuote(zenithQuote, { settings, customer: zenith, productMap: ctx.productMap, offerMap: ctx.offerMap });
  risk = computeRisk(zenithQuote, { settings, customer: zenith, productMap: ctx.productMap, offerMap: ctx.offerMap });
  zenithQuote.riskScore = risk.riskScore;
  zenithQuote.riskLevel = risk.riskLevel;
  zenithQuote.riskReasons = risk.reasons;
  const zenithHealth = await computeDealHealth(zenithQuote, { settings, risk });
  zenithQuote.dealHealthScore = zenithHealth.dealHealthScore;
  zenithQuote.dealHealthStatus = zenithHealth.dealHealthStatus;
  await zenithQuote.save();
  console.log("Zenith draft quote seeded");

  await mongoose.disconnect();
  console.log("\n=== SEED COMPLETE ===");
  console.log("Login  : rep@dealflow360.com / Rep@123 (Sales Rep)");
  console.log("Login  : manager@dealflow360.com / Manager@123");
  console.log("Portal : acme@acme.com / Acme@123 (Gold, Acme Corp)");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});