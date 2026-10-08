import mongoose from "mongoose";

/**
 * A pass bought for one event (config/plans.js EVENT_PASSES).
 * One document per event; upgrading (Celebration → Plus) updates its tier.
 */
const eventPassSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tier: { type: String, enum: ["celebration", "plus", "diaspora"], required: true },
    status: { type: String, enum: ["pending", "active", "refunded"], default: "pending", index: true },
    amount: { type: Number, default: 0 }, // total paid, minor units
    currency: { type: String, default: "NGN" },
    // Tier being paid for (an upgrade keeps the current tier active until paid)
    pendingTier: { type: String, enum: ["celebration", "plus", "diaspora"] },
    paymentRef: String,
    activatedAt: Date,
    history: [
      {
        tier: String,
        amount: Number,
        currency: String,
        payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const EventPass = mongoose.model("EventPass", eventPassSchema);

export default EventPass;
