import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    company: { type: String, default: "" },
    customerTier: { type: String, enum: ["Bronze", "Silver", "Gold", "Platinum"], default: "Bronze" },
    currency: { type: String, default: "INR" },
    creditLimit: { type: Number, default: 0 },
    historicalAverageDiscount: { type: Number, default: 0 },
    preferredProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    negotiationProfile: {
      typicalRequestedDiscount: { type: Number, default: 0 },
      aggressiveness: { type: Number, default: 0.5 },
      previousWinRate: { type: Number, default: 0.5 },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

customerSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

customerSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    company: this.company,
    customerTier: this.customerTier,
    currency: this.currency,
    creditLimit: this.creditLimit,
    historicalAverageDiscount: this.historicalAverageDiscount,
    preferredProducts: this.preferredProducts,
    negotiationProfile: this.negotiationProfile,
    active: this.active,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Customer", customerSchema);