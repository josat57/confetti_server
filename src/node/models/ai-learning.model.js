import mongoose from "mongoose";

const aiLearningSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    userType: {
      type: String,
      enum: ["vendor", "planner", "user", "admin"],
      required: true,
      index: true,
    },

    // Reference to the specific user profile based on userType
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "userRefModel",
    },

    userRefModel: {
      type: String,
      enum: ["Vendor", "User", "Admin"],
    },

    learningData: {
      // Interaction history for learning
      interactions: [
        {
          timestamp: { type: Date, default: Date.now },
          eventType: String,
          budget: {
            amount: Number,
            currency: String,
          },
          clientProfile: mongoose.Schema.Types.Mixed,
          generatedPlan: mongoose.Schema.Types.Mixed,
          feedback: {
            rating: { type: Number, min: 1, max: 5 },
            comments: String,
            successful: Boolean,
          },
        },
      ],

      // Learned preferences and patterns
      preferences: {
        preferredEventTypes: [String],
        budgetRanges: [
          {
            min: Number,
            max: Number,
            currency: String,
            frequency: Number,
          },
        ],
        clientTypes: [String],
        seasonalPreferences: mongoose.Schema.Types.Mixed,
        stylePreferences: mongoose.Schema.Types.Mixed,
      },

      // Success patterns identified by AI
      successPatterns: [
        {
          pattern: String,
          confidence: { type: Number, min: 0, max: 1 },
          frequency: Number,
          lastSeen: Date,
          impact: { type: String, enum: ["low", "medium", "high"] },
        },
      ],

      // Model performance metrics
      accuracy: { type: Number, min: 0, max: 1, default: 0.5 },
      precision: { type: Number, min: 0, max: 1, default: 0.5 },
      recall: { type: Number, min: 0, max: 1, default: 0.5 },
      f1Score: { type: Number, min: 0, max: 1, default: 0.5 },

      // Learning metadata
      totalInteractions: { type: Number, default: 0 },
      lastTrainingDate: Date,
      modelVersion: { type: String, default: "1.0" },
      learningRate: { type: Number, default: 0.01 },
    },

    // AI model configuration
    modelConfig: {
      aiPersonality: {
        type: String,
        enum: ["professional", "creative", "analytical", "friendly", "luxury"],
        default: "professional",
      },
      responseStyle: {
        type: String,
        enum: ["concise", "detailed", "visual", "data-driven"],
        default: "detailed",
      },
      specializations: [String],
      adaptationLevel: {
        type: String,
        enum: ["basic", "intermediate", "advanced", "expert"],
        default: "basic",
      },
    },

    // Performance tracking
    performanceMetrics: {
      clientSatisfactionScore: { type: Number, min: 0, max: 5 },
      planAcceptanceRate: { type: Number, min: 0, max: 1 },
      recommendationClickRate: { type: Number, min: 0, max: 1 },
      conversionRate: { type: Number, min: 0, max: 1 },
      averageResponseTime: Number, // in milliseconds

      // Trend data
      monthlyMetrics: [
        {
          month: String, // YYYY-MM format
          interactions: Number,
          successRate: Number,
          averageRating: Number,
        },
      ],
    },

    // Learning insights and recommendations
    insights: {
      strengths: [String],
      improvementAreas: [String],
      marketOpportunities: [String],
      riskFactors: [String],
      nextLearningGoals: [String],
    },

    // Training data and model state
    trainingData: {
      features: mongoose.Schema.Types.Mixed,
      labels: mongoose.Schema.Types.Mixed,
      weights: mongoose.Schema.Types.Mixed,
      biases: mongoose.Schema.Types.Mixed,
    },

    // Status and metadata
    status: {
      type: String,
      enum: ["initializing", "learning", "trained", "optimizing", "expert"],
      default: "initializing",
    },

    isActive: { type: Boolean, default: true },

    // Audit trail
    lastUpdated: { type: Date, default: Date.now },
    lastInteraction: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
aiLearningSchema.index({ userId: 1, userType: 1, isActive: 1 });
aiLearningSchema.index({ "learningData.lastTrainingDate": -1 });
aiLearningSchema.index({ status: 1, "learningData.accuracy": -1 });

// Compound unique index for user-specific learning models
aiLearningSchema.index({ userId: 1, userType: 1 }, { unique: true });

// Virtual for learning progress
aiLearningSchema.virtual("learningProgress").get(function () {
  const totalInteractions = this.learningData.totalInteractions;
  const accuracy = this.learningData.accuracy;

  if (totalInteractions < 10) return "beginner";
  if (totalInteractions < 50 && accuracy < 0.7) return "learning";
  if (totalInteractions < 100 && accuracy < 0.8) return "improving";
  if (accuracy >= 0.8) return "proficient";
  return "expert";
});

// Virtual for model health
aiLearningSchema.virtual("modelHealth").get(function () {
  const accuracy = this.learningData.accuracy;
  const recentInteractions = this.learningData.interactions.filter(
    (i) => new Date() - new Date(i.timestamp) < 30 * 24 * 60 * 60 * 1000
  ).length;

  if (accuracy >= 0.9 && recentInteractions >= 10) return "excellent";
  if (accuracy >= 0.8 && recentInteractions >= 5) return "good";
  if (accuracy >= 0.6) return "fair";
  return "needs_improvement";
});

// Methods
aiLearningSchema.methods.addInteraction = function (interactionData) {
  this.learningData.interactions.push(interactionData);
  this.learningData.totalInteractions += 1;
  this.lastInteraction = new Date();

  // Update running metrics
  this.updateMetrics();
};

aiLearningSchema.methods.updateMetrics = function () {
  const interactions = this.learningData.interactions;
  const recentInteractions = interactions.slice(-50); // Last 50 interactions

  if (recentInteractions.length > 0) {
    // Calculate accuracy based on feedback
    const feedbackInteractions = recentInteractions.filter(
      (i) => i.feedback && i.feedback.rating
    );
    if (feedbackInteractions.length > 0) {
      const avgRating =
        feedbackInteractions.reduce((sum, i) => sum + i.feedback.rating, 0) /
        feedbackInteractions.length;
      this.learningData.accuracy = Math.min(avgRating / 5, 1); // Normalize to 0-1
    }

    // Update performance metrics
    this.performanceMetrics.clientSatisfactionScore =
      this.learningData.accuracy * 5;
    this.performanceMetrics.planAcceptanceRate =
      recentInteractions.filter((i) => i.feedback?.successful).length /
      recentInteractions.length;
  }
};

aiLearningSchema.methods.identifyPatterns = async function () {
  const interactions = this.learningData.interactions;
  const patterns = [];

  // Identify successful event type patterns
  const eventTypeSuccess = {};
  interactions.forEach((interaction) => {
    if (interaction.feedback?.successful) {
      eventTypeSuccess[interaction.eventType] =
        (eventTypeSuccess[interaction.eventType] || 0) + 1;
    }
  });

  Object.entries(eventTypeSuccess).forEach(([eventType, count]) => {
    if (count >= 3) {
      patterns.push({
        pattern: `Successful with ${eventType} events`,
        confidence: Math.min(count / 10, 1),
        frequency: count,
        lastSeen: new Date(),
        impact: count >= 10 ? "high" : count >= 5 ? "medium" : "low",
      });
    }
  });

  this.learningData.successPatterns = patterns;
  return patterns;
};

aiLearningSchema.methods.generateInsights = function () {
  const patterns = this.learningData.successPatterns;
  const interactions = this.learningData.interactions;

  const insights = {
    strengths: [],
    improvementAreas: [],
    marketOpportunities: [],
    riskFactors: [],
    nextLearningGoals: [],
  };

  // Analyze strengths from patterns
  patterns
    .filter((p) => p.confidence > 0.7)
    .forEach((pattern) => {
      insights.strengths.push(pattern.pattern);
    });

  // Identify improvement areas
  if (this.learningData.accuracy < 0.7) {
    insights.improvementAreas.push("Improve client requirement analysis");
  }

  if (interactions.length < 20) {
    insights.nextLearningGoals.push(
      "Gather more interaction data for better learning"
    );
  }

  this.insights = insights;
  return insights;
};

// Static methods
aiLearningSchema.statics.getTopPerformers = function (
  limit = 10,
  userType = null
) {
  const query = { isActive: true };
  if (userType) query.userType = userType;

  return this.find(query)
    .sort({ "learningData.accuracy": -1, "learningData.totalInteractions": -1 })
    .limit(limit)
    .populate("userRef");
};

aiLearningSchema.statics.getUsersNeedingTraining = function (userType = null) {
  const query = {
    isActive: true,
    $or: [
      { "learningData.accuracy": { $lt: 0.6 } },
      { "learningData.totalInteractions": { $lt: 10 } },
      {
        lastInteraction: {
          $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    ],
  };

  if (userType) query.userType = userType;

  return this.find(query).populate("userRef");
};

// Pre-save middleware
aiLearningSchema.pre("save", function (next) {
  this.lastUpdated = new Date();

  // Update status based on learning progress
  if (
    this.learningData.totalInteractions >= 100 &&
    this.learningData.accuracy >= 0.9
  ) {
    this.status = "expert";
  } else if (
    this.learningData.totalInteractions >= 50 &&
    this.learningData.accuracy >= 0.8
  ) {
    this.status = "optimizing";
  } else if (
    this.learningData.totalInteractions >= 20 &&
    this.learningData.accuracy >= 0.6
  ) {
    this.status = "trained";
  } else if (this.learningData.totalInteractions >= 5) {
    this.status = "learning";
  }

  next();
});

const AILearningModel = mongoose.model("AILearning", aiLearningSchema);

export default AILearningModel;
