import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: {
      type: String,
      required: [true, "Ticket subject is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Ticket description is required"],
    },
    category: {
      type: String,
      required: true,
      enum: [
        "technical",
        "billing",
        "account",
        "event",
        "vendor",
        "general",
        "other",
      ],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    messages: [
      {
        sender: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "messages.senderType",
        },
        senderType: {
          type: String,
          enum: ["User", "Admin"],
        },
        content: {
          type: String,
          required: true,
        },
        attachments: [
          {
            name: String,
            url: String,
            type: String,
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    adminResponse: {
      content: String,
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
      respondedAt: Date,
    },
    resolution: {
      content: String,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
      resolvedAt: Date,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    relatedVendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    // SLA tracking
    sla: {
      firstResponseTime: Date,
      resolutionTime: Date,
      firstResponseDue: Date,
      resolutionDue: Date,
      breached: {
        type: Boolean,
        default: false,
      },
    },
    // Satisfaction rating
    satisfaction: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      feedback: String,
      ratedAt: Date,
    },
    // Internal notes
    internalNotes: [
      {
        admin: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
        },
        note: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Escalation
    escalated: {
      type: Boolean,
      default: false,
    },
    escalatedAt: Date,
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    escalationReason: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
supportTicketSchema.index({ user: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ category: 1, status: 1 });
supportTicketSchema.index({ escalated: 1, status: 1 });

// Methods
supportTicketSchema.methods.assignTo = async function (adminId) {
  this.assignedTo = adminId;
  this.status = "in_progress";
  return this.save();
};

supportTicketSchema.methods.addMessage = function (
  senderId,
  senderType,
  content,
  attachments = []
) {
  this.messages.push({
    sender: senderId,
    senderType,
    content,
    attachments,
    createdAt: new Date(),
  });

  // Update first response time if this is admin's first response
  if (senderType === "Admin" && !this.sla.firstResponseTime) {
    this.sla.firstResponseTime = new Date();
  }

  return this.save();
};

supportTicketSchema.methods.resolve = async function (
  adminId,
  resolutionContent
) {
  this.status = "resolved";
  this.resolution = {
    content: resolutionContent,
    resolvedBy: adminId,
    resolvedAt: new Date(),
  };
  this.sla.resolutionTime = new Date();
  return this.save();
};

supportTicketSchema.methods.close = async function () {
  this.status = "closed";
  return this.save();
};

supportTicketSchema.methods.escalate = async function (adminId, reason) {
  this.escalated = true;
  this.escalatedAt = new Date();
  this.escalatedBy = adminId;
  this.escalationReason = reason;
  this.priority = "urgent";
  return this.save();
};

supportTicketSchema.methods.addInternalNote = function (adminId, note) {
  this.internalNotes.push({
    admin: adminId,
    note,
    createdAt: new Date(),
  });
  return this.save();
};

supportTicketSchema.methods.rateSatisfaction = function (rating, feedback) {
  this.satisfaction = {
    rating,
    feedback,
    ratedAt: new Date(),
  };
  return this.save();
};

// Static methods
supportTicketSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
        total: [{ $count: "count" }],
        open: [
          { $match: { status: { $in: ["open", "in_progress"] } } },
          { $count: "count" },
        ],
        escalated: [
          { $match: { escalated: true, status: { $ne: "closed" } } },
          { $count: "count" },
        ],
        avgSatisfaction: [
          { $match: { "satisfaction.rating": { $exists: true } } },
          { $group: { _id: null, avg: { $avg: "$satisfaction.rating" } } },
        ],
      },
    },
  ]);

  return stats[0];
};

const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);

export default SupportTicket;
