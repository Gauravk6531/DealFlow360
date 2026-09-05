import { Router } from "express";
import * as admin from "../controllers/adminController.js";
import { protect, authorize } from "../middleware/auth.js";
import { getSettings, updateSettings } from "../controllers/settingsController.js";

const router = Router();

router.get("/settings", protect, getSettings);
router.put("/settings", protect, authorize("ADMIN", "SALES_MANAGER", "FINANCE"), updateSettings);

const ALLOWED_TYPES = ["products", "customers", "dealers", "offers", "warehouses", "inventory", "subscriptions", "concessions"];

router.get("/:type", protect, (req, res, next) => {
  if (!ALLOWED_TYPES.includes(req.params.type)) return next();
  admin.list(req, res, next);
});
router.get("/:type/:id", protect, (req, res, next) => {
  if (!ALLOWED_TYPES.includes(req.params.type)) return next();
  admin.getOne(req, res, next);
});
router.post("/:type", protect, authorize("ADMIN", "SALES_MANAGER", "FINANCE"), (req, res, next) => {
  if (!ALLOWED_TYPES.includes(req.params.type)) return next();
  admin.create(req, res, next);
});
router.put("/:type/:id", protect, authorize("ADMIN", "SALES_MANAGER", "FINANCE"), (req, res, next) => {
  if (!ALLOWED_TYPES.includes(req.params.type)) return next();
  admin.update(req, res, next);
});
router.delete("/:type/:id", protect, authorize("ADMIN"), (req, res, next) => {
  if (!ALLOWED_TYPES.includes(req.params.type)) return next();
  admin.remove(req, res, next);
});
router.get("/dealers/:id/offers", protect, admin.dealerOffers);

export default router;