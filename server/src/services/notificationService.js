import Notification from "../models/Notification.js";
import User from "../models/User.js";

export async function notifyRole(role, { title, message, quoteId, type = "system" }) {
  const users = await User.find({ role, active: true });
  return Notification.insertMany(
    users.map((u) => ({ user: u._id, role, title, message, quoteId: quoteId || null, type }))
  );
}

export async function notifyUsers(userIds, { title, message, quoteId, type = "system" }) {
  if (!userIds || userIds.length === 0) return [];
  return Notification.insertMany(
    userIds.map((id) => ({ user: id, title, message, quoteId: quoteId || null, type }))
  );
}