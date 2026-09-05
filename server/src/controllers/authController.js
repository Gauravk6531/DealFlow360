import User from "../models/User.js";
import Customer from "../models/Customer.js";
import { ApiError } from "../utils/error.js";
import { asyncHandler } from "../utils/helpers.js";
import { signToken } from "../middleware/auth.js";
import { ROLES } from "../config/constants.js";

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, company } = req.body;
  const allowedRole = role === "CUSTOMER" ? "CUSTOMER" : "SALES_REP";
  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(400, "Email already registered");
  const user = await User.create({ name, email, password, role: allowedRole, company: company || "" });
  const token = signToken({ id: user._id, type: "user" });
  res.status(201).json({ success: true, token, user: user.toSafeJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, "Invalid email or password");
  if (!user.active) throw new ApiError(403, "Account deactivated");
  const token = signToken({ id: user._id, type: "user" });
  res.json({ success: true, token, user: user.toSafeJSON() });
});

export const customerLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const customer = await Customer.findOne({ email }).select("+password");
  if (!customer || !(await customer.comparePassword(password))) throw new ApiError(401, "Invalid email or password");
  if (!customer.active) throw new ApiError(403, "Account deactivated");
  const token = signToken({ id: customer._id, type: "customer" });
  res.json({ success: true, token, customer: customer.toSafeJSON() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const customerMe = asyncHandler(async (req, res) => {
  res.json({ success: true, customer: req.customer.toSafeJSON() });
});

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ role: { $ne: "CUSTOMER" } }).select("-password");
  res.json({ success: true, users });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, company } = req.body;
  if (!ROLES[role] || role === ROLES.CUSTOMER) throw new ApiError(400, "Invalid role");
  const user = await User.create({ name, email, password, role, company });
  res.status(201).json({ success: true, user: user.toSafeJSON() });
});