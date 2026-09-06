import Approval from "../models/Approval.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { buildApprovalChain } from "./riskService.js";
import { ApiError } from "../utils/error.js";

/**
 * Routing is derived from the risk score ONLY — salespeople never pick
 * the approval chain.
 *   0-20                      -> no approval (auto)
 *   21-50                     -> Sales Manager
 *   51+                       -> Sales Manager -> Finance
 */
export async function runApprovals(quote, { settings, risk, actor, reason }) {
  const chain = risk?.approvalChain || buildApprovalChain(risk.riskScore, settings);
  const pending = await Approval.find({ quoteId: quote._id, status: "Pending" });

  if (chain.length === 0) {
    quote.approvalStatus = "Approved";
    quote.approvalChain = [];
    for (const p of pending) {
      p.status = "Skipped";
      await p.save();
    }
    await AuditLog.create({
      user: actor?._id,
      userEmail: actor?.email,
      action: "AUTO_APPROVED",
      entity: "Quotation",
      entityId: quote._id,
      quoteId: quote._id,
      reason: `Risk score ${risk.riskScore} is within the autonomous approval limit`,
    });
    await quote.save();
    return { chain: [], autoApproved: true };
  }

  quote.approvalStatus = "Pending";
  quote.approvalChain = chain;
  await quote.save();

  const created = [];
  for (let i = 0; i < chain.length; i++) {
    const role = chain[i];
    const app = await Approval.create({
      quoteId: quote._id,
      approvalLevel: i + 1,
      approverRole: role,
      status: i === 0 ? "Pending" : "Skipped",
      previousValue: { riskScore: risk.riskScore, discount: quote.weightedDiscountPct },
      newValue: null,
      requestedBy: actor?._id || null,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    const approver = await findApprover(role);
    if (approver) {
      app.approver = approver._id;
      await app.save();
      await Notification.create({
        user: approver._id,
        role,
        type: "approval",
        title: `Quote ${quote.quoteNumber} requires ${roleLabel(role)} approval`,
        message: `Risk score ${risk.riskScore}. Discount ${quote.weightedDiscountPct}% against approved ceilings.`,
        quoteId: quote._id,
      });
    }
    created.push(app);
  }
  return { chain, created };
}

export async function findApprover(role) {
  return User.findOne({ role, active: true }).collation({ locale: "en", strength: 2 });
}

export async function clearPendingApprovals(quote, reason) {
  await Approval.updateMany(
    { quoteId: quote._id, status: "Pending" },
    { $set: { status: "Skipped", reason: reason || "No approval required after auto-accepted negotiation" } }
  );
  quote.approvalStatus = "Approved";
  quote.approvalChain = [];
  await quote.save();
}

function roleLabel(role) {
  return role === "SALES_MANAGER" ? "Sales Manager" : role === "FINANCE" ? "Finance" : role;
}

export async function resolveApproval({ approval, quote, status, approver, reason }) {
  if (approval.status !== "Pending") {
    throw new ApiError(409, "Approval request already decided. Refresh the queue.");
  }
  if (approval.expiresAt && new Date() > new Date(approval.expiresAt)) {
    approval.status = "Expired";
    approval.reason = reason || "Approval window expired";
    approval.timestamp = new Date();
    await approval.save();
    await Notification.create({
      role: "SALES_REP",
      type: "approval",
      title: `Quote ${quote.quoteNumber} approval expired`,
      message: "The approval request was not reviewed within 7 days.",
      quoteId: quote._id,
    }).catch(() => {});
    throw new ApiError(410, "Approval request has expired. Re-submit the quote to request a new approval.");
  }
  if (approval.requestedBy && approver && String(approval.requestedBy) === String(approver._id) && approver.role !== "ADMIN") {
    throw new ApiError(403, "You cannot approve your own request.");
  }

  approval.status = status === "approve" ? "Approved" : "Rejected";
  approval.approver = approver._id;
  approval.reason = reason || "";
  approval.timestamp = new Date();
  await approval.save();

  await AuditLog.create({
    user: approver._id,
    userEmail: approver.email,
    action: status === "approve" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
    entity: "Approval",
    entityId: approval._id,
    quoteId: quote._id,
    reason,
    oldValue: { approvalStatus: quote.approvalStatus },
  });

  if (status === "reject") {
    quote.approvalStatus = "Rejected";
    await Approval.updateMany({ quoteId: quote._id, status: "Pending" }, { status: "Skipped" });
    await Notification.create({
      role: "SALES_REP",
      type: "approval",
      title: `Quote ${quote.quoteNumber} was rejected`,
      message: reason || "The approval request was declined.",
      quoteId: quote._id,
    });
    await quote.save();
    return { approved: false };
  }

  if (approval.status !== "Approved") {
    throw new ApiError(409, "Only an approved step can advance the chain.");
  }

  // Activate the next level in the chain (if any), regardless of its prior status.
  const next = await Approval.findOne({ quoteId: quote._id, approvalLevel: { $gt: approval.approvalLevel } }).sort({
    approvalLevel: 1,
  });

  if (!next) {
    quote.approvalStatus = "Approved";
    await quote.save();
    await Notification.create({
      role: "SALES_REP",
      type: "approval",
      title: `Quote ${quote.quoteNumber} fully approved`,
      message: "All approvals granted.",
      quoteId: quote._id,
    });
    return { approved: true, fullyApproved: true };
  }

  next.status = "Pending";
  const approver2 = await findApprover(next.approverRole);
  if (approver2) {
    next.approver = approver2._id;
    await Notification.create({
      user: approver2._id,
      role: next.approverRole,
      type: "approval",
      title: `Quote ${quote.quoteNumber} needs ${roleLabel(next.approverRole)} approval`,
      message: "Previous level approved. Escalating to the next approval step.",
      quoteId: quote._id,
    });
  }
  await next.save();
  await quote.save();
  return { approved: true, nextStep: next.approverRole };
}