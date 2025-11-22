import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      index: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    customer: {
      name: {
        type: String,
        required: [true, "Customer name is required"],
        trim: true,
      },
      email: {
        type: String,
        required: [true, "Customer email is required"],
        lowercase: true,
        trim: true,
      },
      phone: String,
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
      },
    },
    items: [
      {
        description: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: [0, "Quantity cannot be negative"],
          default: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
          min: [0, "Unit price cannot be negative"],
        },
        total: {
          type: Number,
          required: true,
        },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, "Tax rate cannot be negative"],
      max: [100, "Tax rate cannot exceed 100%"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
    },
    amountDue: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    paidAt: Date,
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "partial", "overdue", "cancelled"],
      default: "draft",
      index: true,
    },
    paymentMethod: String,
    paymentReference: String,
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    terms: {
      type: String,
      maxlength: [2000, "Terms cannot exceed 2000 characters"],
    },
    sentAt: Date,
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    payments: [
      {
        amount: {
          type: Number,
          required: true,
        },
        method: String,
        reference: String,
        paidAt: {
          type: Date,
          default: Date.now,
        },
        notes: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes
invoiceSchema.index({ vendor: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ vendor: 1, booking: 1 });
invoiceSchema.index({ "customer.email": 1, vendor: 1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

// Virtual for checking if invoice is overdue
invoiceSchema.virtual("isOverdue").get(function () {
  if (this.status === "paid" || this.status === "cancelled") return false;
  return this.dueDate < new Date();
});

// Virtual for days until due
invoiceSchema.virtual("daysUntilDue").get(function () {
  if (!this.dueDate) return null;
  const now = new Date();
  const diffTime = this.dueDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to calculate totals
invoiceSchema.methods.calculateTotals = function () {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => {
    item.total = item.quantity * item.unitPrice;
    return sum + item.total;
  }, 0);

  // Calculate tax
  const taxAmount = (this.subtotal * this.taxRate) / 100;
  this.tax = taxAmount;

  // Calculate total
  this.total = this.subtotal + taxAmount - this.discount;

  // Calculate amount due
  this.amountDue = this.total - this.amountPaid;

  return this;
};

// Method to record payment
invoiceSchema.methods.recordPayment = function (
  amount,
  method,
  reference,
  notes
) {
  this.payments.push({
    amount,
    method,
    reference,
    notes,
    paidAt: new Date(),
  });

  this.amountPaid += amount;
  this.amountDue = this.total - this.amountPaid;

  // Update status
  if (this.amountPaid >= this.total) {
    this.status = "paid";
    this.paidAt = new Date();
  } else if (this.amountPaid > 0) {
    this.status = "partial";
  }

  return this.save();
};

// Method to send invoice
invoiceSchema.methods.send = function (userId) {
  this.status = "sent";
  this.sentAt = new Date();
  this.sentBy = userId;
  return this.save();
};

// Method to mark as paid
invoiceSchema.methods.markAsPaid = function (method, reference) {
  const remainingAmount = this.amountDue;
  return this.recordPayment(remainingAmount, method, reference, "Full payment");
};

// Method to cancel invoice
invoiceSchema.methods.cancel = function () {
  this.status = "cancelled";
  return this.save();
};

// Static method to generate invoice number
invoiceSchema.statics.generateInvoiceNumber = async function (vendorId) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}`;

  const lastInvoice = await this.findOne({
    vendor: vendorId,
    invoiceNumber: new RegExp(`^${prefix}`),
  })
    .sort({ createdAt: -1 })
    .select("invoiceNumber");

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split("-")[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, "0")}`;
};

// Static method to get overdue invoices
invoiceSchema.statics.getOverdue = async function (vendorId) {
  const now = new Date();
  return this.find({
    vendor: vendorId,
    status: { $in: ["sent", "partial"] },
    dueDate: { $lt: now },
  })
    .populate("booking", "eventDate eventType")
    .sort({ dueDate: 1 });
};

// Static method to get pending payments
invoiceSchema.statics.getPending = async function (vendorId) {
  return this.find({
    vendor: vendorId,
    status: { $in: ["sent", "partial"] },
  })
    .populate("booking", "eventDate eventType")
    .sort({ dueDate: 1 });
};

// Pre-save middleware to calculate totals
invoiceSchema.pre("save", function (next) {
  if (
    this.isModified("items") ||
    this.isModified("discount") ||
    this.isModified("taxRate")
  ) {
    this.calculateTotals();
  }

  // Auto-mark as overdue
  if (
    this.dueDate &&
    this.dueDate < new Date() &&
    ["sent", "partial"].includes(this.status)
  ) {
    this.status = "overdue";
  }

  next();
});

// Pre-save middleware to generate invoice number
invoiceSchema.pre("save", async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    this.invoiceNumber = await this.constructor.generateInvoiceNumber(
      this.vendor
    );
  }
  next();
});

const Invoice = mongoose.model("Invoice", invoiceSchema);

export default Invoice;
