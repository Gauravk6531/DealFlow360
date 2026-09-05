import { Router } from "express";
import { register, login, me, customerLogin, customerMe, listUsers, createUser } from "../controllers/authController.js";
import { protect, protectCustomer, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/customer/login", customerLogin);

router.get("/me", protect, me);
router.get("/customer/me", protectCustomer, customerMe);

router.get("/users", protect, authorize("ADMIN", "SALES_MANAGER"), listUsers);
router.post("/users", protect, authorize("ADMIN"), createUser);

export default router;