import mongoose from "mongoose";

const dataRetentionPolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dataType: {
      type: String,
      required: true,
      enum: [
        "user_data",
        "audit_logs",
        "payment_records",
        "event_data",
        "messages",
        "notifications",
        "analytics",
        "backups",
        "session_data",
        "temporary_files",
      ],
    },
    retentionPeriod: {
      value: { type: Number, required: true },
      unit: { type: String, enum: ["days", "months", "years"], required: true },
    },
    description: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    autoDelete: {
      type: Boolean,
      default: false,
    },
    archiveBeforeDelete: {
      type: Boolean,
      default: true,
    },
    legalBasis: {
      type: String,
      enum: [
        "consent",
        "contract",
        "legal_obligation",
        "legitimate_interest",
        "vital_interest",
        "public_interest",
      ],
    },
    exceptions: [
      {
        condition: String,
        extendedPeriod: {
          value: Number,
          unit: String,
        },
        reason: String,
      },
    ],
    lastApplied: {
      type: Date,
    },
    recordsAffected: {
      type: Number,
      default: 0,
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
dataRetentionPolicySchema.index({ dataType: 1, isActive: 1 });

const DataRetentionPolicy = mongoose.model(
  "DataRetentionPolicy",
  dataRetentionPolicySchema
);

export default DataRetentionPolicy;
