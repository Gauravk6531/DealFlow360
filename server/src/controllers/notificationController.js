import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import { asyncHandler } from "../utils/helpers.js";

export const myNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({
    $or: [{ user: req.user._id }, { role: req.user.role }, { role: { $in: ["SALES_REP"] }, user: null }],
  })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ success: true, notifications });
});

export const readNotification = asyncHandler(async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ success: true });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { $or: [{ user: req.user._id }, { role: req.user.role }] },
    { read: true }
  );
  res.json({ success: true });
});

export const auditLogs = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("quoteId");
  res.json({ success: true, logs });
});