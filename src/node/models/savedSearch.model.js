import mongoose from "mongoose";

const savedSearchSchema = new mongoose.Schema(
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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    searchType: {
      type: String,
      enum: [
        "global",
        "users",
        "vendors",
        "events",
        "transactions",
        "tickets",
        "notifications",
        "audit_logs",
      ],
      required: true,
    },
    query: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
    },
    sortBy: {
      type: String,
    },
    sortOrder: {
      type: String,
      enum: ["asc", "desc"],
      default: "desc",
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Indexes
savedSearchSchema.index({ user: 1, searchType: 1 });
savedSearchSchema.index({ isPublic: 1 });
savedSearchSchema.index({ tags: 1 });

const SavedSearch = mongoose.model("SavedSearch", savedSearchSchema);

export default SavedSearch;
