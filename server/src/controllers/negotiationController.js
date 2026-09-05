import Negotiation from "../models/Negotiation.js";
import { asyncHandler } from "../utils/helpers.js";

export const listNegotiations = asyncHandler(async (req, res) => {
  const negotiations = await Negotiation.find({})
    .populate("quoteId")
    .populate("customerId")
    .sort({ createdAt: -1 });
  res.json({ success: true, negotiations });
});