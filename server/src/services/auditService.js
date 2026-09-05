import AuditLog from "../models/AuditLog.js";

export async function logAudit({ user, action, entity, entityId, quoteId, oldValue, newValue, reason }) {
  const entry = await AuditLog.create({
    user: user?._id,
    userEmail: user?.email,
    action,
    entity: entity || "System",
    entityId: entityId || null,
    quoteId: quoteId || null,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    reason: reason || "",
  });
  return entry;
}

export const ACTIONS = {
  QUOTE_CREATED: "Quote created",
  QUOTE_UPDATED: "Quote updated",
  DISCOUNT_CHANGED: "Discount changed",
  DEALER_CHANGED: "Dealer changed",
  NEGOTIATION_SUBMITTED: "Negotiation submitted",
  COUNTER_GENERATED: "Counter-offer generated",
  APPROVAL_REQUESTED: "Approval requested",
  APPROVAL_GRANTED: "Approval granted",
  APPROVAL_REJECTED: "Approval rejected",
  CUSTOMER_CONFIRMED: "Customer confirmed",
  FULFILLMENT_CHANGED: "Fulfillment changed",
  QUOTE_WON: "Quote won",
  WHAT_IF_RUN: "What-If simulation run",
};