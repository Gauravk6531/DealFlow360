import { Router } from "express";
import * as customer from "../controllers/customerController.js";
import { protectCustomer } from "../middleware/auth.js";

const router = Router();

router.use(protectCustomer);

router.get("/dashboard", customer.portalDashboard);
router.get("/quotes", customer.myQuotes);
router.get("/quotes/:id", customer.getQuote);
router.post("/quotes/:id/comment", customer.commentLine);
router.post("/quotes/:id/negotiate", customer.requestNegotiation);
router.post("/quotes/:id/accept-counter", customer.acceptCounterOffer);
router.post("/quotes/:id/confirm", customer.confirmQuote);

export default router;