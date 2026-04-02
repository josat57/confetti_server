import mongoose from "mongoose";

const cannedResponseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    category: {
      type: String,
      required: true,
      enum: [
        "technical",
        "billing",
        "account",
        "event",
        "vendor",
        "general",
        "other",
      ],
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    shortcut: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    lastUsedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
cannedResponseSchema.index({ category: 1, isActive: 1 });
cannedResponseSchema.index({ shortcut: 1 });
cannedResponseSchema.index({ tags: 1 });

// Method to increment usage
cannedResponseSchema.methods.incrementUsage = async function () {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

const CannedResponse = mongoose.model("CannedResponse", cannedResponseSchema);

export default CannedResponse;
