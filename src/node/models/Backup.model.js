import mongoose from "mongoose";

const backupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ["full", "incremental", "differential"],
      default: "full",
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "restoring"],
      default: "pending",
    },
    databases: [String],
    collections: [String],
    filePath: String,
    fileSize: Number,
    checksum: String,
    durationMs: Number,
    completedAt: Date,
    error: String,
    // "ejson-ndjson" = type-preserving streaming format. Missing = legacy plain
    // JSON backup (ObjectIds/Dates stored as strings) which cannot be restored safely.
    format: { type: String, enum: ["json-legacy", "ejson-ndjson"] },
    trigger: {
      type: String,
      enum: ["manual", "scheduled", "pre_restore"],
      default: "manual",
    },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "BackupSchedule" },
    // Backup this incremental/differential backup is based on
    baseBackup: { type: mongoose.Schema.Types.ObjectId, ref: "Backup" },
    // Set on pre-restore safety snapshots
    restoreOf: { type: mongoose.Schema.Types.ObjectId, ref: "Backup" },
    lastRestoredAt: Date,
    lastRestoredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    restoreError: String,
    lastSafetyBackup: { type: mongoose.Schema.Types.ObjectId, ref: "Backup" },
    metadata: {
      mongoVersion: String,
      nodeVersion: String,
      totalDocuments: Number,
      since: Date,
      note: String,
      collectionStats: [
        {
          name: String,
          count: Number,
          sizeBytes: Number,
        },
      ],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

backupSchema.index({ status: 1, createdAt: -1 });
backupSchema.index({ createdBy: 1, createdAt: -1 });
backupSchema.index({ schedule: 1, status: 1, createdAt: -1 });

const Backup = mongoose.model("Backup", backupSchema);
export default Backup;
