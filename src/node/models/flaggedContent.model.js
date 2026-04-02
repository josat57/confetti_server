import mongoose from "mongoose";

const flaggedContentSchema = new mongoose.Schema(
  {
    // Content reference
    contentType: {
      type: String,
      required: [true, "Content type is required"],
      enum: ["profile", "event", "review", "message", "vendor", "post"],
      index: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Content ID is required"],
      index: true,
    },
    contentOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Reporter information
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter is required"],
      index: true,
    },
    reporterEmail: String,
    reporterName: String,

    // Report details
    reason: {
      type: String,
      required: [true, "Report reason is required"],
      enum: [
        "spam",
        "inappropriate",
        "harassment",
        "violence",
        "hate_speech",
        "false_information",
        "copyright",
        "privacy_violation",
        "scam",
        "other",
      ],
    },
    description: {
      type: String,
      required: [true, "Report description is required"],
      maxlength: 1000,
    },
    category: {
      type: String,
      enum: ["content", "behavior", "legal", "safety"],
      default: "content",
    },

    // Status and review
    status: {
      type: String,
      enum: ["pending", "under_review", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },

    // Admin review
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    reviewedAt: Date,
    reviewNotes: String,

    // Action taken
    action: {
      type: String,
      enum: [
        "none",
        "warning_sent",
        "content_removed",
        "user_suspended",
        "user_banned",
        "content_edited",
      ],
    },
    actionDetails: String,
    actionTakenAt: Date,

    // Evidence
    screenshots: [String],
    additionalEvidence: [
      {
        type: String,
        url: String,
        description: String,
      },
    ],

    // Metadata
    ipAddress: String,
    userAgent: String,
    reportCount: {
      type: Number,
      default: 1,
    },
    relatedReports: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FlaggedContent",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
flaggedContentSchema.index({ contentType: 1, contentId: 1 });
flaggedContentSchema.index({ status: 1, priority: -1, createdAt: -1 });
flaggedContentSchema.index({ reportedBy: 1, createdAt: -1 });
flaggedContentSchema.index({ contentOwnerId: 1 });
flaggedContentSchema.index({ reviewedBy: 1 });

// Compound index for efficient queries
flaggedContentSchema.index({ status: 1, contentType: 1, priority: -1 });

// Virtual for content reference
flaggedContentSchema.virtual("content", {
  refPath: "contentType",
  localField: "contentId",
  foreignField: "_id",
  justOne: true,
});

// Method to mark as under review
flaggedContentSchema.methods.markUnderReview = async function (adminId) {
  this.status = "under_review";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  return this.save();
};

// Method to resolve report
flaggedContentSchema.methods.resolve = async function (adminId, action, notes) {
  this.status = "resolved";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.action = action;
  this.reviewNotes = notes;
  this.actionTakenAt = new Date();
  return this.save();
};

// Method to dismiss report
flaggedContentSchema.methods.dismiss = async function (adminId, notes) {
  this.status = "dismissed";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.action = "none";
  this.reviewNotes = notes;
  return this.save();
};

// Static method to get report statistics
flaggedContentSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byContentType: [
          { $group: { _id: "$contentType", count: { $sum: 1 } } },
        ],
        byReason: [{ $group: { _id: "$reason", count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
        total: [{ $count: "count" }],
        pending: [{ $match: { status: "pending" } }, { $count: "count" }],
      },
    },
  ]);

  return stats[0];
};

// Ensure virtuals are included in JSON
flaggedContentSchema.set("toJSON", { virtuals: true });
flaggedContentSchema.set("toObject", { virtuals: true });

const FlaggedContent = mongoose.model("FlaggedContent", flaggedContentSchema);

export default FlaggedContent;
