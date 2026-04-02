import mongoose from "mongoose";

const gdprRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestType: {
      type: String,
      enum: [
        "access",
        "rectification",
        "erasure",
        "portability",
        "restriction",
        "objection",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    description: {
      type: String,
    },
    verificationMethod: {
      type: String,
      enum: ["email", "phone", "id_document", "two_factor"],
      required: true,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },
    verifiedAt: {
      type: Date,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    dueDate: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    dataExported: {
      fileUrl: String,
      fileSize: Number,
      format: String,
      expiresAt: Date,
    },
    dataDeleted: {
      deletedAt: Date,
      recordsDeleted: Number,
      backupCreated: Boolean,
      backupLocation: String,
    },
    notes: [
      {
        admin: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        content: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    timeline: [
      {
        action: String,
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
gdprRequestSchema.index({ user: 1, requestType: 1 });
gdprRequestSchema.index({ status: 1, dueDate: 1 });
gdprRequestSchema.index({ createdAt: -1 });

const GDPRRequest = mongoose.model("GDPRRequest", gdprRequestSchema);

export default GDPRRequest;
