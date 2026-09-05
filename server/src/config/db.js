import mongoose from "mongoose";

export async function connectDB(uri) {
  const mongoUri = uri || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dealflow360";
  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    throw err;
  }
}