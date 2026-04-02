import mongoose from "mongoose";

const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "general",
        "payment",
        "email",
        "sms",
        "security",
        "features",
        "subscription",
        "notification",
      ],
    },
    description: {
      type: String,
      trim: true,
    },
    dataType: {
      type: String,
      enum: ["string", "number", "boolean", "object", "array"],
      default: "string",
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    isEditable: {
      type: Boolean,
      default: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
systemConfigSchema.index({ key: 1 });
systemConfigSchema.index({ category: 1 });

const SystemConfig = mongoose.model("SystemConfig", systemConfigSchema);

export default SystemConfig;
