import mongoose from "mongoose";

const aiEventPlanResultSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIEventPlanRequest",
      required: true,
      index: true,
    },
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    teaserData: {
      eventSummary: {
        eventType: String,
        eventDate: Date,
        location: String,
        guestCount: Number,
        totalBudget: Number,
        currency: String,
        formality: String,
      },
      budgetBreakdown: {
        categories: [
          {
            name: String,
            percentage: Number,
            amount: Number,
            priority: String,
            confidence: Number,
          },
        ],
        totalAllocated: Number,
        contingency: Number,
        feasibilityScore: Number,
      },
      vendorCategories: [
        {
          name: String,
          estimatedCost: {
            min: Number,
            max: Number,
          },
          priority: String,
          locked: Boolean,
          vendorCount: Number,
        },
      ],
      timeline: mongoose.Schema.Types.Mixed,
      recommendations: [String],
      aiInsights: mongoose.Schema.Types.Mixed,
    },
    fullPlanData: {
      vendors: [
        {
          vendorId: mongoose.Schema.Types.ObjectId,
          category: String,
          matchScore: Number,
          reasons: [String],
          estimatedCost: Number,
        },
      ],
      detailedTimeline: mongoose.Schema.Types.Mixed,
      actionItems: mongoose.Schema.Types.Mixed,
      resources: mongoose.Schema.Types.Mixed,
    },
    analysisMetadata: {
      processingTimeMs: Number,
      feasibilityScore: Number,
      vendorsAnalyzed: Number,
      aiModelVersion: String,
      pythonServiceVersion: String,
    },
    status: {
      type: String,
      enum: ["draft", "teaser", "full"],
      default: "teaser",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
aiEventPlanResultSchema.index({ sessionToken: 1 });
aiEventPlanResultSchema.index({ userId: 1, createdAt: -1 });
aiEventPlanResultSchema.index({ requestId: 1 });

// Virtual to check if user has access to full plan
aiEventPlanResultSchema.virtual("hasFullAccess").get(function () {
  return this.userId != null && this.status === "full";
});

// Method to upgrade to full plan
aiEventPlanResultSchema.methods.upgradeToFull = async function (
  userId,
  fullPlanData
) {
  this.userId = userId;
  this.fullPlanData = fullPlanData;
  this.status = "full";
  return this.save();
};

const AIEventPlanResult = mongoose.model(
  "AIEventPlanResult",
  aiEventPlanResultSchema
);

export default AIEventPlanResult;
