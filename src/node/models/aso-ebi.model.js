import mongoose from "mongoose";

/**
 * Aso-ebi for an event (Celebration Plus, roadmap Phase 8): the fabrics on offer
 * and each person's order (size, payment, collection).
 */
const fabricSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 }, // "Gold lace", "Gele"
    description: { type: String, trim: true, maxlength: 1000 },
    color: { type: String, trim: true, maxlength: 60 },
    unit: { type: String, enum: ["yard", "piece", "set", "bundle"], default: "piece" },
    price: { type: Number, required: true, min: 0 }, // naira per unit
    stock: { type: Number, min: 0 }, // units available, if limited
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ASO_EBI_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "custom"];

const orderSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    fabric: { type: mongoose.Schema.Types.ObjectId, ref: "AsoEbiFabric", required: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest" },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40 },
    quantity: { type: Number, required: true, min: 1, max: 1000 },
    size: { type: String, enum: ASO_EBI_SIZES },
    measurements: { type: String, trim: true, maxlength: 500 }, // free text for custom sizes
    amountDue: { type: Number, required: true, min: 0 }, // naira
    amountPaid: { type: Number, default: 0, min: 0 },
    payments: [
      {
        amount: { type: Number, required: true, min: 0 },
        method: { type: String, enum: ["cash", "transfer", "pos", "other"], default: "transfer" },
        note: { type: String, trim: true, maxlength: 200 },
        at: { type: Date, default: Date.now },
      },
    ],
    collectionStatus: { type: String, enum: ["pending", "ready", "collected"], default: "pending" },
    collectedAt: Date,
    collectedBy: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

orderSchema.virtual("paymentStatus").get(function () {
  if ((this.amountPaid || 0) <= 0) return this.amountDue > 0 ? "unpaid" : "paid";
  return this.amountPaid >= this.amountDue ? "paid" : "partial";
});
orderSchema.virtual("balance").get(function () {
  return Math.max((this.amountDue || 0) - (this.amountPaid || 0), 0);
});

orderSchema.index({ event: 1, fabric: 1 });

export const AsoEbiFabric = mongoose.model("AsoEbiFabric", fabricSchema);
export const AsoEbiOrder = mongoose.model("AsoEbiOrder", orderSchema);
