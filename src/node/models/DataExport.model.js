import mongoose from "mongoose";

const dataExportSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["users", "events", "vendors", "payments", "analytics", "full"],
      required: true,
    },
    format: { type: String, enum: ["csv", "json"], required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    filters: { type: mongoose.Schema.Types.Mixed },
    filePath: String,
    fileSize: Number,
    rowCount: Number,
    downloadToken: String,
    expiresAt: Date,
    completedAt: Date,
    error: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

dataExportSchema.index({ status: 1, createdAt: -1 });
dataExportSchema.index({ createdBy: 1 });
dataExportSchema.index({ downloadToken: 1 });

const DataExport = mongoose.model("DataExport", dataExportSchema);
export default DataExport;
