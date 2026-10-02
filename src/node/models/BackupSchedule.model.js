import mongoose from "mongoose";

const backupScheduleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ["full", "incremental"],
      default: "full",
    },
    frequency: {
      type: String,
      enum: ["hourly", "daily", "weekly", "monthly"],
      required: true,
    },
    isEnabled: { type: Boolean, default: true },
    retentionDays: { type: Number, default: 30 },
    databases: [String],
    collections: [String],
    nextRun: Date,
    lastRun: Date,
    lastStatus: {
      type: String,
      enum: ["success", "failed", "running", "skipped"],
    },
    lastBackup: { type: mongoose.Schema.Types.ObjectId, ref: "Backup" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

backupScheduleSchema.index({ isEnabled: 1, nextRun: 1 });

backupScheduleSchema.methods.computeNextRun = function () {
  const now = new Date();
  switch (this.frequency) {
    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly": {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 1);
      return d;
    }
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
};

const BackupSchedule = mongoose.model("BackupSchedule", backupScheduleSchema);
export default BackupSchedule;
