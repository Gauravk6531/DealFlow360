import { ApiError } from "../utils/error.js";

export const requireFields = (fields) => (req, res, next) => {
  const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === "");
  if (missing.length) throw new ApiError(400, `Missing required fields: ${missing.join(", ")}`);
  next();
};

export const requirePositiveNumber = (...fields) => (req, res, next) => {
  for (const f of fields) {
    if (req.body[f] !== undefined && (typeof req.body[f] !== "number" || req.body[f] < 0)) {
      throw new ApiError(400, `Field ${f} must be a non-negative number`);
    }
  }
  next();
};