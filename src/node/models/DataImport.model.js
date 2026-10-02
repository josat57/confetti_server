import mongoose from "mongoose";

const dataImportSchema = new mongoose.Schema(
  {
    originalFileName: { type: String, required: true },
    type: {
      type: String,
      enum: ["users", "events", "vendors"],
      required: true,
    },
    format: { type: String, enum: ["csv", "json"], required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "partial"],
      default: "pending",
    },
    filePath: String,
    totalRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0 },
    successRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    errors: [
      {
        row: Number,
        field: String,
        message: String,
      },
    ],
    completedAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

dataImportSchema.index({ status: 1, createdAt: -1 });
dataImportSchema.index({ createdBy: 1 });

const DataImport = mongoose.model("DataImport", dataImportSchema);
export default DataImport;
