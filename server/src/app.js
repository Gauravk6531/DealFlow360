import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import quoteRoutes from "./routes/quoteRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import { notFoundHandler, errorHandler } from "./utils/error.js";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ success: true, service: "DealFlow360 API", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api", quoteRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;