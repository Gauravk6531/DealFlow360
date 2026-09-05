export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);

export function deriveStage(q) {
  if (q.lostAt) return "Lost";
  if (q.wonAt) return "Won";
  if (q.confirmedAt) return q.invoiceIssued ? "Billing" : "Fulfillment";
  if (q.approvalStatus === "Pending") return "Approval";
  if (q.negotiationStatus === "Negotiating" || q.negotiationStatus === "Counter Offered") return "Negotiation";
  if (q.approvalStatus === "Approved") return "Approved";
  if (q.submittedAt) return "Sent";
  return "Draft";
}