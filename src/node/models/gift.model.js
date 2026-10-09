import mongoose from "mongoose";

/**
 * Gift registry items and gifts received for an event, with thank-you tracking
 * (Celebration Plus, roadmap Phase 8).
 * - kind "registry": something the hosts would like (quantity wanted / received)
 * - kind "received": a gift that arrived (optionally against a registry item)
 */
const giftSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    kind: { type: String, enum: ["registry", "received"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    category: { type: String, enum: ["item", "cash", "voucher", "experience", "other"], default: "item" },
    amount: { type: Number, min: 0 }, // registry: price; received: cash value (naira)
    currency: { type: String, default: "NGN" },

    // Registry
    link: { type: String, trim: true, maxlength: 1000 },
    quantityWanted: { type: Number, min: 1, default: 1 },
    quantityReceived: { type: Number, min: 0, default: 0 },

    // Received
    fromName: { type: String, trim: true, maxlength: 200 },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest" },
    registryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Gift" },
    receivedAt: Date,
    thankYou: {
      status: { type: String, enum: ["not_sent", "sent"], default: "not_sent" },
      sentAt: Date,
      method: { type: String, enum: ["card", "message", "call", "in_person", "other"] },
    },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

giftSchema.index({ event: 1, kind: 1, createdAt: -1 });

const Gift = mongoose.model("Gift", giftSchema);
export default Gift;
