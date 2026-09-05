export const ROLES = {
  SALES_REP: "SALES_REP",
  SALES_MANAGER: "SALES_MANAGER",
  FINANCE: "FINANCE",
  ADMIN: "ADMIN",
  CUSTOMER: "CUSTOMER",
};

export const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];

export const TIER_DISCOUNT_LIMITS = {
  Bronze: 5,
  Silver: 10,
  Gold: 15,
  Platinum: 20,
};

export const CATEGORY_DISCOUNT_LIMITS = {
  Hardware: 15,
  Software: 12,
  Services: 10,
  Subscription: 8,
  Accessories: 15,
};

export const QUOTE_STATUS = [
  "Draft",
  "Sent",
  "Negotiation",
  "Approval",
  "Approved",
  "Fulfillment",
  "Billing",
  "Won",
  "Lost",
];

export const NEGOTIATION_DECISIONS = ["AUTO_ACCEPT", "COUNTER_OFFER", "ESCALATE", "REJECT"];

export const NEGOTIATION_STATUS = [
  "Pending",
  "Counter Offered",
  "Approved",
  "Rejected",
  "Escalated",
  "Accepted",
];

export const BILLING_CYCLES = ["Monthly", "Quarterly", "Yearly"];

export const DEFAULT_SETTINGS = {
  tierDiscountLimits: TIER_DISCOUNT_LIMITS,
  categoryDiscountLimits: CATEGORY_DISCOUNT_LIMITS,
  approvalThresholds: { autoMax: 20, managerMax: 50 },
  minCompanyMarginPct: 10,
  dealerMinMarginPct: 8,
  negotiationBudget: 50000,
  risk: {
    inactivityDays: 5,
    inactivityWeight: 15,
    highNegotiationRounds: 3,
    negotiationWeight: 10,
    approvalDelayDays: 2,
    approvalWeight: 10,
    discountEffortWeight: 15,
    inventoryShortageWeight: 20,
  },
  historicalDiscountOvershoot: 0.15,
};

export const CONCESSION_CATEGORIES = ["Value", "Service", "Delivery", "Support", "Warranty"];