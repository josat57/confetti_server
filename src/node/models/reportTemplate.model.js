import mongoose from "mongoose";

const reportTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    reportType: {
      type: String,
      enum: [
        "user_analytics",
        "financial",
        "vendor_performance",
        "event_analytics",
        "support_metrics",
        "custom",
      ],
      required: true,
    },
    metrics: [
      {
        name: String,
        label: String,
        type: String,
        aggregation: String,
      },
    ],
    filters: {
      type: mongoose.Schema.Types.Mixed,
    },
    groupBy: {
      type: String,
      enum: ["day", "week", "month", "quarter", "year", "none"],
    },
    sortBy: {
      field: String,
      order: { type: String, enum: ["asc", "desc"], default: "desc" },
    },
    visualization: {
      type: String,
      enum: ["table", "chart", "graph", "mixed"],
      default: "table",
    },
    format: {
      type: String,
      enum: ["pdf", "csv", "xlsx", "json"],
      default: "pdf",
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
reportTemplateSchema.index({ reportType: 1 });
reportTemplateSchema.index({ isPublic: 1 });
reportTemplateSchema.index({ createdBy: 1 });

const ReportTemplate = mongoose.model("ReportTemplate", reportTemplateSchema);

export default ReportTemplate;
