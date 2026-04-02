import mongoose from "mongoose";

const abTestParticipantSchema = new mongoose.Schema(
  {
    testKey: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    variantKey: {
      type: String,
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    converted: {
      type: Boolean,
      default: false,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    events: [
      {
        eventType: String,
        eventData: {
          type: Map,
          of: mongoose.Schema.Types.Mixed,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
abTestParticipantSchema.index({ testKey: 1, userId: 1 }, { unique: true });
abTestParticipantSchema.index({ testKey: 1, variantKey: 1 });
abTestParticipantSchema.index({ testKey: 1, converted: 1 });

export default mongoose.model("ABTestParticipant", abTestParticipantSchema);
