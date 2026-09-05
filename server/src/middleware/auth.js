import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import { ApiError } from "../utils/error.js";
import { asyncHandler } from "../utils/helpers.js";

export const protect = asyncHandler(async (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) throw new ApiError(401, "Not authorized, no token");
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, "Not authorized, token invalid or expired");
  }
  const user = await User.findById(decoded.id).select("-password");
  if (!user || !user.active) throw new ApiError(401, "User not found or inactive");
  req.user = user;
  next();
});

export const protectCustomer = asyncHandler(async (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) throw new ApiError(401, "Not authorized, no token");
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, "Not authorized, token invalid or expired");
  }
  if (decoded.type !== "customer") throw new ApiError(401, "Customer token required");
  const customer = await Customer.findById(decoded.id).select("-password");
  if (!customer || !customer.active) throw new ApiError(401, "Customer not found or inactive");
  req.customer = customer;
  next();
});

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) throw new ApiError(401, "Not authorized");
  if (!roles.includes(req.user.role)) {
    throw new ApiError(403, `Role ${req.user.role} not allowed for this action`);
  }
  next();
};

export const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || "7d" });