import { Router } from "express";
import * as customer from "../controllers/customerController.js";
import { protectCustomer } from "../middleware/auth.js";
import { idempotent } from "../middleware/security.js";

const router = Router();

router.use(protectCustomer);

router.get("/dashboard", customer.portalDashboard);
router.get("/quotes", customer.myQuotes);
router.get("/quotes/:id", customer.getQuote);
router.post("/quotes/:id/comment", idempotent, customer.commentLine);
router.post("/quotes/:id/negotiate", idempotent, customer.requestNegotiation);
router.post("/quotes/:id/accept-counter", idempotent, customer.acceptCounterOffer);
router.post("/quotes/:id/confirm", idempotent, customer.confirmQuote);

export default router;