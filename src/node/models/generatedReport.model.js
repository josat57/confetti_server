import mongoose from "mongoose";

const generatedReportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportTemplate",
    },
    scheduledReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScheduledReport",
    },
    reportType: {
      type: String,
      required: true,
    },
    dateRange: {
      startDate: Date,
      endDate: Date,
    },
    status: {
      type: String,
      enum: ["pending", "generating", "completed", "failed"],
      default: "pending",
    },
    format: {
      type: String,
      enum: ["pdf", "csv", "xlsx", "json"],
      default: "pdf",
    },
    fileUrl: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    summary: {
      type: mongoose.Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    generatedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    lastDownloadedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
generatedReportSchema.index({ generatedBy: 1, createdAt: -1 });
generatedReportSchema.index({ status: 1 });
generatedReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const GeneratedReport = mongoose.model(
  "GeneratedReport",
  generatedReportSchema
);

export default GeneratedReport;
