import mongoose from "mongoose";

const errorLogSchema = new mongoose.Schema(
  {
    errorType: {
      type: String,
      enum: [
        "application",
        "database",
        "network",
        "validation",
        "authentication",
        "authorization",
        "external_api",
        "unknown",
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    stack: {
      type: String,
    },
    code: {
      type: String,
    },
    endpoint: {
      type: String,
    },
    method: {
      type: String,
    },
    statusCode: {
      type: Number,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
    },
    resolution: {
      type: String,
    },
    occurrenceCount: {
      type: Number,
      default: 1,
    },
    lastOccurrence: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
errorLogSchema.index({ errorType: 1, severity: 1, createdAt: -1 });
errorLogSchema.index({ resolved: 1, severity: 1 });
errorLogSchema.index({ endpoint: 1, createdAt: -1 });

// TTL index - automatically delete resolved errors older than 90 days
errorLogSchema.index(
  { resolvedAt: 1 },
  { expireAfterSeconds: 7776000, partialFilterExpression: { resolved: true } }
);

const ErrorLog = mongoose.model("ErrorLog", errorLogSchema);

export default ErrorLog;
