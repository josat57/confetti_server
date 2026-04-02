import mongoose from "mongoose";

const scheduledReportSchema = new mongoose.Schema(
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
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportTemplate",
      required: true,
    },
    schedule: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
        required: true,
      },
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
      },
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
      },
      time: {
        type: String,
        default: "09:00",
      },
      timezone: {
        type: String,
        default: "UTC",
      },
    },
    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    emailRecipients: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastRun: {
      type: Date,
    },
    nextRun: {
      type: Date,
    },
    runCount: {
      type: Number,
      default: 0,
    },
    lastStatus: {
      type: String,
      enum: ["success", "failed", "pending"],
      default: "pending",
    },
    lastError: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
scheduledReportSchema.index({ nextRun: 1, isActive: 1 });
scheduledReportSchema.index({ createdBy: 1 });

const ScheduledReport = mongoose.model(
  "ScheduledReport",
  scheduledReportSchema
);

export default ScheduledReport;
