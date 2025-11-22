import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
      index: true,
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
    },
    eventDetails: {
      type: {
        type: String,
        required: [true, "Event type is required"],
      },
      date: Date,
      location: String,
      venue: String,
      guestCount: {
        type: Number,
        min: [0, "Guest count cannot be negative"],
      },
      budget: {
        type: Number,
        min: [0, "Budget cannot be negative"],
      },
      description: {
        type: String,
        maxlength: [2000, "Description cannot exceed 2000 characters"],
      },
    },
    status: {
      type: String,
      enum: ["new", "contacted", "quoted", "negotiating", "won", "lost"],
      default: "new",
      index: true,
    },
    source: {
      type: String,
      enum: ["website", "referral", "social", "direct", "other"],
      default: "website",
      index: true,
    },
    notes: [
      {
        text: {
          type: String,
          required: true,
          maxlength: [1000, "Note cannot exceed 1000 characters"],
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        isPrivate: {
          type: Boolean,
          default: false,
        },
      },
    ],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    estimatedValue: {
      type: Number,
      min: [0, "Estimated value cannot be negative"],
    },
    followUpDate: {
      type: Date,
      index: true,
    },
    lastContactedAt: Date,
    convertedToBooking: {
      type: Boolean,
      default: false,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    quote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    customFields: {
      type: Map,
      of: String,
    },
    lostReason: {
      type: String,
      maxlength: [500, "Lost reason cannot exceed 500 characters"],
    },
    responseTime: {
      type: Number, // in hours
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
leadSchema.index({ vendor: 1, status: 1, createdAt: -1 });
leadSchema.index({ vendor: 1, assignedTo: 1, status: 1 });
leadSchema.index({ vendor: 1, followUpDate: 1 });
leadSchema.index({ "customer.email": 1, vendor: 1 });

// Virtual for days since creation
leadSchema.virtual("daysSinceCreation").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days until follow-up
leadSchema.virtual("daysUntilFollowUp").get(function () {
  if (!this.followUpDate) return null;
  const now = new Date();
  const diffTime = this.followUpDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for checking if follow-up is overdue
leadSchema.virtual("isFollowUpOverdue").get(function () {
  if (!this.followUpDate) return false;
  return this.followUpDate < new Date();
});

// Method to add a note
leadSchema.methods.addNote = function (text, userId, isPrivate = false) {
  this.notes.push({
    text,
    createdBy: userId,
    isPrivate,
    createdAt: new Date(),
  });
  return this.save();
};

// Method to update status
leadSchema.methods.updateStatus = function (newStatus, userId, note) {
  const oldStatus = this.status;
  this.status = newStatus;

  // Add automatic note about status change
  if (note) {
    this.notes.push({
      text: `Status changed from ${oldStatus} to ${newStatus}. ${note}`,
      createdBy: userId,
      createdAt: new Date(),
    });
  }

  // Update last contacted if moving to contacted
  if (newStatus === "contacted" && oldStatus === "new") {
    this.lastContactedAt = new Date();
    // Calculate response time
    const diffTime = this.lastContactedAt - this.createdAt;
    this.responseTime = diffTime / (1000 * 60 * 60); // in hours
  }

  return this.save();
};

// Method to assign lead
leadSchema.methods.assign = function (userId) {
  this.assignedTo = userId;
  return this.save();
};

// Method to mark as won
leadSchema.methods.markAsWon = function (bookingId, userId) {
  this.status = "won";
  this.convertedToBooking = true;
  this.booking = bookingId;
  this.notes.push({
    text: "Lead converted to booking",
    createdBy: userId,
    createdAt: new Date(),
  });
  return this.save();
};

// Method to mark as lost
leadSchema.methods.markAsLost = function (reason, userId) {
  this.status = "lost";
  this.lostReason = reason;
  this.notes.push({
    text: `Lead marked as lost. Reason: ${reason}`,
    createdBy: userId,
    createdAt: new Date(),
  });
  return this.save();
};

// Method to set follow-up date
leadSchema.methods.setFollowUp = function (date, userId, note) {
  this.followUpDate = date;
  if (note) {
    this.notes.push({
      text: `Follow-up scheduled for ${date.toLocaleDateString()}. ${note}`,
      createdBy: userId,
      createdAt: new Date(),
    });
  }
  return this.save();
};

// Static method to get leads by status
leadSchema.statics.getByStatus = async function (vendorId, status) {
  return this.find({
    vendor: vendorId,
    status,
  })
    .populate("assignedTo", "name email")
    .sort({ createdAt: -1 });
};

// Static method to get leads needing follow-up
leadSchema.statics.getNeedingFollowUp = async function (vendorId) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return this.find({
    vendor: vendorId,
    followUpDate: { $lte: today },
    status: { $nin: ["won", "lost"] },
  })
    .populate("assignedTo", "name email")
    .sort({ followUpDate: 1 });
};

// Static method to get overdue leads
leadSchema.statics.getOverdue = async function (vendorId) {
  const now = new Date();

  return this.find({
    vendor: vendorId,
    followUpDate: { $lt: now },
    status: { $nin: ["won", "lost"] },
  })
    .populate("assignedTo", "name email")
    .sort({ followUpDate: 1 });
};

// Static method to get lead statistics
leadSchema.statics.getStatistics = async function (
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
        new: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
        contacted: {
          $sum: { $cond: [{ $eq: ["$status", "contacted"] }, 1, 0] },
        },
        quoted: { $sum: { $cond: [{ $eq: ["$status", "quoted"] }, 1, 0] } },
        negotiating: {
          $sum: { $cond: [{ $eq: ["$status", "negotiating"] }, 1, 0] },
        },
        won: { $sum: { $cond: [{ $eq: ["$status", "won"] }, 1, 0] } },
        lost: { $sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] } },
        totalValue: { $sum: "$estimatedValue" },
        avgValue: { $avg: "$estimatedValue" },
        avgResponseTime: { $avg: "$responseTime" },
      },
    },
  ]);

  return (
    stats[0] || {
      total: 0,
      new: 0,
      contacted: 0,
      quoted: 0,
      negotiating: 0,
      won: 0,
      lost: 0,
      totalValue: 0,
      avgValue: 0,
      avgResponseTime: 0,
    }
  );
};

// Static method to get conversion rate
leadSchema.statics.getConversionRate = async function (vendorId) {
  const total = await this.countDocuments({ vendor: vendorId });
  const won = await this.countDocuments({ vendor: vendorId, status: "won" });

  return total > 0 ? (won / total) * 100 : 0;
};

// Pre-save middleware to set default follow-up date
leadSchema.pre("save", function (next) {
  // Set default follow-up date to 3 days from now if not set
  if (this.isNew && !this.followUpDate) {
    const followUp = new Date();
    followUp.setDate(followUp.getDate() + 3);
    this.followUpDate = followUp;
  }

  next();
});

const Lead = mongoose.model("Lead", leadSchema);

export default Lead;
