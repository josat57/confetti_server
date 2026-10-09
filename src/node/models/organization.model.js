import mongoose from "mongoose";

/**
 * Corporate accounts (roadmap Phase 11): a company with members and roles,
 * departments and budgets, an annual contract billed by invoice, purchase
 * requests that need an approver's sign-off, and invoices in the company's name.
 */

export const ORG_ROLES = ["admin", "approver", "requester"];

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ORG_ROLES, required: true },
  department: { type: String, trim: true, maxlength: 80 },
  addedAt: { type: Date, default: Date.now },
});

const inviteSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ORG_ROLES, default: "requester" },
  department: { type: String, trim: true, maxlength: 80 },
  token: { type: String, required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    legalName: { type: String, trim: true, maxlength: 200 },
    rcNumber: { type: String, trim: true, maxlength: 40 }, // CAC registration
    vatNumber: { type: String, trim: true, maxlength: 40 }, // TIN / VAT
    billingEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: {
      street: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 80 },
      state: { type: String, trim: true, maxlength: 80 },
      country: { type: String, trim: true, maxlength: 80, default: "Nigeria" },
    },
    members: [memberSchema],
    invites: [inviteSchema],
    departments: [{ type: String, trim: true, maxlength: 80 }],
    // Spending limits per department and year (naira)
    budgets: [
      {
        department: { type: String, trim: true, maxlength: 80 },
        year: { type: Number, required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    // Purchases at or under this amount (naira) are approved automatically; 0 = always ask
    approvalThreshold: { type: Number, default: 0, min: 0 },
    contract: {
      status: { type: String, enum: ["none", "requested", "invoiced", "active", "expired", "cancelled"], default: "none" },
      amount: Number, // naira per year, before VAT
      startsAt: Date,
      endsAt: Date,
      requestedAt: Date,
      requestNotes: String,
      renewalInvoicedAt: Date,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

organizationSchema.index({ "members.user": 1 });
organizationSchema.index({ "invites.token": 1 });

organizationSchema.methods.memberFor = function (userId) {
  return this.members.find((m) => String(m.user?._id || m.user) === String(userId)) || null;
};
organizationSchema.virtual("contractActive").get(function () {
  return this.contract?.status === "active" && this.contract.endsAt > new Date();
});

const purchaseSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    number: { type: String, index: true }, // PR-2026-0001
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "VendorBooking", required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    department: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 2000 },
    amount: { type: Number, required: true, min: 0 }, // naira
    currency: { type: String, default: "NGN" },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedAt: Date,
    decisionNote: String,
    autoApproved: { type: Boolean, default: false },
    // Every step, for audit
    log: [
      {
        action: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    number: { type: String, required: true, unique: true }, // CFT-2026-0001
    kind: { type: String, enum: ["contract", "renewal"], default: "contract" },
    // The company as billed (copied at issue time)
    billedTo: {
      name: String,
      rcNumber: String,
      vatNumber: String,
      email: String,
      address: String,
    },
    items: [{ description: String, amount: Number }],
    subtotal: { type: Number, required: true }, // naira
    vatRate: { type: Number, default: 0.075 },
    vat: { type: Number, required: true },
    total: { type: Number, required: true },
    currency: { type: String, default: "NGN" },
    periodStart: Date,
    periodEnd: Date,
    issuedAt: { type: Date, default: Date.now },
    dueDate: Date,
    status: { type: String, enum: ["issued", "paid", "void"], default: "issued", index: true },
    paidAt: Date,
    paymentMethod: { type: String, enum: ["card", "transfer"] },
    paymentReference: String,
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  },
  { timestamps: true }
);

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });

export const Organization = mongoose.model("Organization", organizationSchema);
export const PurchaseRequest = mongoose.model("PurchaseRequest", purchaseSchema);
export const CorporateInvoice = mongoose.model("CorporateInvoice", invoiceSchema);
export const CorporateCounter = mongoose.model("CorporateCounter", counterSchema);

/** Next number in a yearly series: PR-2026-0001, CFT-2026-0001 */
export const nextNumber = async (prefix, date = new Date()) => {
  const year = date.getFullYear();
  const { seq } = await CorporateCounter.findOneAndUpdate({ _id: `${prefix}-${year}` }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
};
