import mongoose from "mongoose";

const blockedIPSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, trim: true },
    reason: { type: String, trim: true },
    // "auto" = blocked by the security monitor (e.g. brute-force), "manual" = by an admin
    source: { type: String, enum: ["auto", "manual"], default: "manual" },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    // null = permanent; otherwise removed automatically by the TTL index
    expiresAt: { type: Date, default: null },
    hits: { type: Number, default: 0 },
    lastHitAt: Date,
  },
  { timestamps: true }
);

blockedIPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const BlockedIP = mongoose.models.BlockedIP || mongoose.model("BlockedIP", blockedIPSchema);
export default BlockedIP;
