import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
      index: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      index: true,
    },
    quoteNumber: {
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
      phone: {
        type: String,
        trim: true,
      },
      company: {
        type: String,
        trim: true,
      },
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
          required: [true, "Item description is required"],
          trim: true,
        },
        quantity: {
          type: Number,
          required: [true, "Quantity is required"],
          min: [0, "Quantity cannot be negative"],
          default: 1,
        },
        unitPrice: {
          type: Number,
          required: [true, "Unit price is required"],
          min: [0, "Unit price cannot be negative"],
        },
        total: {
          type: Number,
          required: true,
        },
        category: {
          type: String,
          trim: true,
        },
        notes: {
          type: String,
          maxlength: [500, "Item notes cannot exceed 500 characters"],
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
    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    validUntil: {
      type: Date,
      required: true,
      index: true,
    },
    terms: {
      type: String,
      maxlength: [2000, "Terms cannot exceed 2000 characters"],
    },
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    internalNotes: {
      type: String,
      maxlength: [1000, "Internal notes cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "accepted", "rejected", "expired"],
      default: "draft",
      index: true,
    },
    sentAt: Date,
    viewedAt: Date,
    respondedAt: Date,
    expiresAt: Date,
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuoteTemplate",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paymentTerms: {
      type: String,
      maxlength: [500, "Payment terms cannot exceed 500 characters"],
    },
    depositRequired: {
      type: Number,
      min: [0, "Deposit cannot be negative"],
    },
    depositPercentage: {
      type: Number,
      min: [0, "Deposit percentage cannot be negative"],
      max: [100, "Deposit percentage cannot exceed 100%"],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
quoteSchema.index({ vendor: 1, status: 1, createdAt: -1 });
quoteSchema.index({ vendor: 1, lead: 1 });
quoteSchema.index({ "customer.email": 1, vendor: 1 });
quoteSchema.index({ quoteNumber: 1 }, { unique: true });

// Virtual for checking if quote is expired
quoteSchema.virtual("isExpired").get(function () {
  if (!this.validUntil) return false;
  return this.validUntil < new Date();
});

// Virtual for days until expiration
quoteSchema.virtual("daysUntilExpiration").get(function () {
  if (!this.validUntil) return null;
  const now = new Date();
  const diffTime = this.validUntil - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to calculate totals
quoteSchema.methods.calculateTotals = function () {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => {
    item.total = item.quantity * item.unitPrice;
    return sum + item.total;
  }, 0);

  // Calculate discount
  let discountAmount = 0;
  if (this.discountType === "percentage") {
    discountAmount = (this.subtotal * this.discount) / 100;
  } else {
    discountAmount = this.discount;
  }

  // Calculate tax
  const taxableAmount = this.subtotal - discountAmount;
  const taxAmount = (taxableAmount * this.taxRate) / 100;
  this.tax = taxAmount;

  // Calculate total
  this.total = this.subtotal - discountAmount + taxAmount;

  return this;
};

// Method to send quote
quoteSchema.methods.send = function (userId) {
  this.status = "sent";
  this.sentAt = new Date();
  this.sentBy = userId;
  return this.save();
};

// Method to mark as viewed
quoteSchema.methods.markAsViewed = function () {
  if (this.status === "sent" && !this.viewedAt) {
    this.status = "viewed";
    this.viewedAt = new Date();
  }
  return this.save();
};

// Method to accept quote
quoteSchema.methods.accept = function () {
  this.status = "accepted";
  this.respondedAt = new Date();
  return this.save();
};

// Method to reject quote
quoteSchema.methods.reject = function () {
  this.status = "rejected";
  this.respondedAt = new Date();
  return this.save();
};

// Method to mark as expired
quoteSchema.methods.markAsExpired = function () {
  this.status = "expired";
  this.expiresAt = new Date();
  return this.save();
};

// Method to duplicate quote
quoteSchema.methods.duplicate = async function () {
  const duplicateData = this.toObject();
  delete duplicateData._id;
  delete duplicateData.quoteNumber;
  delete duplicateData.createdAt;
  delete duplicateData.updatedAt;
  delete duplicateData.sentAt;
  delete duplicateData.viewedAt;
  delete duplicateData.respondedAt;
  delete duplicateData.expiresAt;
  delete duplicateData.sentBy;

  duplicateData.status = "draft";
  duplicateData.quoteNumber = await this.constructor.generateQuoteNumber(
    this.vendor
  );

  // Set new valid until date (30 days from now)
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  duplicateData.validUntil = validUntil;

  return this.constructor.create(duplicateData);
};

// Static method to generate quote number
quoteSchema.statics.generateQuoteNumber = async function (vendorId) {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}`;

  // Find the last quote number for this vendor and year
  const lastQuote = await this.findOne({
    vendor: vendorId,
    quoteNumber: new RegExp(`^${prefix}`),
  })
    .sort({ createdAt: -1 })
    .select("quoteNumber");

  let sequence = 1;
  if (lastQuote) {
    const lastSequence = parseInt(lastQuote.quoteNumber.split("-")[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, "0")}`;
};

// Static method to get quotes by status
quoteSchema.statics.getByStatus = async function (vendorId, status) {
  return this.find({
    vendor: vendorId,
    status,
  })
    .populate("lead", "customer eventDetails")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });
};

// Static method to get expiring quotes
quoteSchema.statics.getExpiring = async function (vendorId, days = 7) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    vendor: vendorId,
    status: { $in: ["sent", "viewed"] },
    validUntil: {
      $gte: now,
      $lte: futureDate,
    },
  })
    .populate("lead", "customer")
    .sort({ validUntil: 1 });
};

// Static method to get quote statistics
quoteSchema.statics.getStatistics = async function (
  vendorId,
  startDate,
  endDate
) {
  const match = { vendor: vendorId };
  if (startDate && endDate) {
    match.createdAt = { $gte: startDate, $lte: endDate };
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
        sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
        viewed: { $sum: { $cond: [{ $eq: ["$status", "viewed"] }, 1, 0] } },
        accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        expired: { $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] } },
        totalValue: { $sum: "$total" },
        avgValue: { $avg: "$total" },
        acceptedValue: {
          $sum: {
            $cond: [{ $eq: ["$status", "accepted"] }, "$total", 0],
          },
        },
      },
    },
  ]);

  return (
    stats[0] || {
      total: 0,
      draft: 0,
      sent: 0,
      viewed: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      totalValue: 0,
      avgValue: 0,
      acceptedValue: 0,
    }
  );
};

// Static method to get acceptance rate
quoteSchema.statics.getAcceptanceRate = async function (vendorId) {
  const sent = await this.countDocuments({
    vendor: vendorId,
    status: { $in: ["sent", "viewed", "accepted", "rejected"] },
  });
  const accepted = await this.countDocuments({
    vendor: vendorId,
    status: "accepted",
  });

  return sent > 0 ? (accepted / sent) * 100 : 0;
};

// Pre-save middleware to calculate totals
quoteSchema.pre("save", function (next) {
  if (
    this.isModified("items") ||
    this.isModified("discount") ||
    this.isModified("taxRate")
  ) {
    this.calculateTotals();
  }

  // Auto-expire if past valid until date
  if (
    this.validUntil &&
    this.validUntil < new Date() &&
    this.status === "sent"
  ) {
    this.status = "expired";
    this.expiresAt = new Date();
  }

  next();
});

// Pre-save middleware to generate quote number
quoteSchema.pre("save", async function (next) {
  if (this.isNew && !this.quoteNumber) {
    this.quoteNumber = await this.constructor.generateQuoteNumber(this.vendor);
  }
  next();
});

const Quote = mongoose.model("Quote", quoteSchema);

export default Quote;
