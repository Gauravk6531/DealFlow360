import { Router } from "express";
import { register, login, me, customerLogin, customerMe, listUsers, createUser } from "../controllers/authController.js";
import { protect, protectCustomer, authorize } from "../middleware/auth.js";
import { authLimiter } from "../middleware/security.js";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/customer/login", authLimiter, customerLogin);

router.get("/me", protect, me);
router.get("/customer/me", protectCustomer, customerMe);

router.get("/users", protect, authorize("ADMIN", "SALES_MANAGER"), listUsers);
router.post("/users", protect, authorize("ADMIN"), createUser);

export default router;