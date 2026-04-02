import mongoose from "mongoose";

const systemMetricSchema = new mongoose.Schema(
  {
    metricType: {
      type: String,
      enum: [
        "cpu",
        "memory",
        "disk",
        "network",
        "database",
        "api",
        "queue",
        "cache",
      ],
      required: true,
      index: true,
    },
    value: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      enum: ["percent", "bytes", "ms", "count", "requests_per_second"],
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    threshold: {
      warning: Number,
      critical: Number,
    },
    status: {
      type: String,
      enum: ["normal", "warning", "critical"],
      default: "normal",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
systemMetricSchema.index({ metricType: 1, timestamp: -1 });
systemMetricSchema.index({ status: 1, timestamp: -1 });

// TTL index - automatically delete records older than 30 days
systemMetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

const SystemMetric = mongoose.model("SystemMetric", systemMetricSchema);

export default SystemMetric;
