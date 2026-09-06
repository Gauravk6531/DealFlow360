import Negotiation from "../models/Negotiation.js";
import { asyncHandler } from "../utils/helpers.js";

export const listNegotiations = asyncHandler(async (req, res) => {
  const quoteFilter = req.user.role === "SALES_REP" ? { salesRepId: req.user._id } : {};
  const quoteIds = await (await import("../models/Quotation.js")).default.find(quoteFilter).distinct("_id");
  const negotiations = await Negotiation.find({ quoteId: { $in: quoteIds } })
    .populate("quoteId")
    .populate("customerId")
    .sort({ createdAt: -1 });
  res.json({ success: true, negotiations });
});