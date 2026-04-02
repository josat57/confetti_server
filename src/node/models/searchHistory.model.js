import mongoose from "mongoose";

const searchHistorySchema = new mongoose.Schema(
  {
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
      type: String,
      required: true,
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
    },
    resultsCount: {
      type: Number,
      default: 0,
    },
    executionTime: {
      type: Number,
      description: "Execution time in milliseconds",
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
searchHistorySchema.index({ user: 1, createdAt: -1 });
searchHistorySchema.index({ searchType: 1 });
searchHistorySchema.index({ query: "text" });

// TTL index - automatically delete records older than 90 days
searchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const SearchHistory = mongoose.model("SearchHistory", searchHistorySchema);

export default SearchHistory;
