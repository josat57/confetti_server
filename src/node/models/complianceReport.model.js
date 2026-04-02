import mongoose from "mongoose";

const complianceReportSchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      enum: [
        "gdpr",
        "data_export",
        "data_deletion",
        "access_log",
        "security_audit",
        "user_activity",
        "financial_audit",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dateRange: {
      startDate: Date,
      endDate: Date,
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
    },
    results: {
      totalRecords: { type: Number, default: 0 },
      summary: mongoose.Schema.Types.Mixed,
      findings: [mongoose.Schema.Types.Mixed],
      recommendations: [String],
    },
    fileUrl: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    format: {
      type: String,
      enum: ["pdf", "csv", "json", "xlsx"],
      default: "pdf",
    },
    expiresAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
complianceReportSchema.index({ requestedBy: 1, createdAt: -1 });
complianceReportSchema.index({ reportType: 1, status: 1 });
complianceReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ComplianceReport = mongoose.model(
  "ComplianceReport",
  complianceReportSchema
);

export default ComplianceReport;
