import mongoose from "mongoose";

/**
 * A period of featured placement for a vendor: bought (₦5,000/week) or from the
 * plan's monthly credits. Vendor.isFeatured/featuredUntil mirror the latest active one.
 */
const featuredBoostSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    vendorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    category: { type: String, required: true, index: true },
    kind: { type: String, enum: ["paid", "credit"], required: true },
    weeks: { type: Number, min: 1, max: 4, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["pending_payment", "active", "cancelled"], default: "pending_payment", index: true },
    amount: { type: Number, default: 0 }, // minor units
    currency: { type: String, default: "NGN" },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    reference: String,
    // Month a credit was used in ("2026-10")
    creditMonth: String,
  },
  { timestamps: true }
);

featuredBoostSchema.index({ category: 1, status: 1, startsAt: 1, endsAt: 1 });

const FeaturedBoost = mongoose.model("FeaturedBoost", featuredBoostSchema);

export default FeaturedBoost;
