import { Router } from "express";
import * as quote from "../controllers/quoteController.js";
import * as negotiation from "../controllers/negotiationController.js";
import * as notification from "../controllers/notificationController.js";
import * as dashboard from "../controllers/dashboardController.js";
import * as report from "../controllers/reportController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.use(protect);

// Quotes
router.get("/quotes", quote.listQuotes);
router.post("/quotes", quote.createQuote);
router.get("/quotes/:id", quote.getQuote);
router.put("/quotes/:id", quote.updateQuote);
router.post("/quotes/:id/add-line", quote.addLine);
router.delete("/quotes/:id/lines/:lineId", quote.removeLine);
router.post("/quotes/:id/submit", quote.submitQuote);
router.post("/quotes/:id/what-if", quote.whatIf);
router.post("/quotes/:id/negotiate", quote.negotiate);
router.post("/quotes/:id/accept-counter", authorize("SALES_REP", "SALES_MANAGER", "ADMIN", "FINANCE"), quote.acceptCounterOffer);
router.get("/quotes/:id/dealer-comparison", quote.dealerComparison);
router.post("/quotes/:id/concessions", quote.applyConcessions);
router.post("/quotes/:id/fulfillment", quote.fulfillmentPlan);
router.get("/quotes/:id/billing", quote.billingPreview);
router.post("/quotes/:id/confirm", authorize("SALES_REP", "SALES_MANAGER", "ADMIN", "FINANCE"), quote.confirmQuote);
router.post("/quotes/:id/lost", quote.markLost);

// Approvals
router.get("/approvals", quote.listApprovals);
router.post("/approvals/:id/review", quote.reviewApproval);

// Negotiations
router.get("/negotiations", negotiation.listNegotiations);

// Notifications + audit
router.get("/notifications", notification.myNotifications);
router.post("/notifications/:id/read", notification.readNotification);
router.post("/notifications/read-all", notification.markAllRead);

router.get("/audit", authorize("ADMIN", "SALES_MANAGER", "FINANCE"), notification.auditLogs);

// Dashboards
router.get("/dashboard", dashboard.dashboard);
router.get("/dashboard/deal-intelligence", dashboard.dealIntelligenceCtl);
router.get("/dashboard/dealer-intelligence", dashboard.dealerIntelligenceCtl);

// Reports
router.get("/reports", report.reports);

export default router;