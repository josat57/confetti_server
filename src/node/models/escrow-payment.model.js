import mongoose from "mongoose";

/**
 * A client's payment for a booking, held by Confetti until the vendor delivers.
 * Amounts are in minor units (kobo). Commission is fixed at payment time from
 * the vendor's plan (config/plans.js commissionRate).
 */
const escrowPaymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "VendorBooking", required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    vendorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "NGN" },
    kind: { type: String, enum: ["deposit", "balance", "full"], default: "balance" },
    commissionRate: { type: Number, required: true, min: 0, max: 1 },
    vendorPlan: String,
    status: {
      type: String,
      enum: ["pending_payment", "held", "released", "refunded", "disputed", "cancelled"],
      default: "pending_payment",
      index: true,
    },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    paymentProvider: { type: String, enum: ["flutterwave", "paystack"] },
    reference: { type: String, index: true },
    paidAt: Date,
    // Released automatically after this (event end + grace) unless disputed
    releaseAfter: { type: Date, index: true },
    releasedAt: Date,
    releaseReason: { type: String, enum: ["client_confirmed", "auto", "admin"] },
    // Amounts settled at release/refund (minor units)
    releasedAmount: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    vendorAmount: { type: Number, default: 0 },
    payout: {
      status: { type: String, enum: ["not_started", "processing", "paid", "failed", "manual"], default: "not_started" },
      provider: String,
      reference: String,
      transferCode: String,
      paidAt: Date,
      failureReason: String,
      markedPaidBy: { type: mongoose.Schema.Types.ObjectId },
    },
    refund: {
      amount: { type: Number, default: 0 },
      reason: String,
      refundedAt: Date,
      providerReference: String,
      status: { type: String, enum: ["none", "processing", "done", "failed", "manual"], default: "none" },
    },
    dispute: {
      openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      openedByRole: String,
      reason: String,
      openedAt: Date,
      resolvedAt: Date,
      resolution: { type: String, enum: ["release", "refund", "split"] },
      adminNote: String,
      resolvedBy: { type: mongoose.Schema.Types.ObjectId },
    },
    history: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

escrowPaymentSchema.index({ status: 1, releaseAfter: 1 });

const EscrowPayment = mongoose.model("EscrowPayment", escrowPaymentSchema);

export default EscrowPayment;
