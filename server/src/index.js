import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB(process.env.MONGO_URI);
  const server = app.listen(PORT, () => {
    console.log(`DealFlow360 API running on http://localhost:${PORT}`);
  });
  server.on("error", (err) => {
    console.error("Server error:", err.message);
    process.exit(1);
  });
}

start().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});