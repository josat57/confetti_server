import mongoose from "mongoose";

const aiPlanSchema = new mongoose.Schema(
  {
    // User identification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    userType: {
      type: String,
      enum: ["vendor", "planner", "user", "admin", "guest"],
      required: true,
      index: true,
    },

    // Session tracking for guests and temporary plans
    sessionId: {
      type: String,
      index: true,
      sparse: true, // Only for guest users
    },

    // Plan identification
    planId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // Original request data
    originalRequest: {
      eventType: String,
      budget: {
        amount: Number,
        currency: { type: String, default: "NGN" },
        flexibility: {
          type: String,
          enum: ["strict", "flexible", "very_flexible"],
        },
      },
      guestCount: Number,
      location: {
        city: String,
        state: String,
        country: String,
        venue: String,
        coordinates: {
          lat: Number,
          lng: Number,
        },
      },
      date: {
        preferred: Date,
        flexible: Boolean,
        alternatives: [Date],
      },
      requirements: mongoose.Schema.Types.Mixed,
      preferences: mongoose.Schema.Types.Mixed,
      clientProfile: mongoose.Schema.Types.Mixed,
    },

    // Generated AI plan
    aiPlan: {
      // Core plan structure
      overview: {
        concept: String,
        theme: String,
        style: String,
        atmosphere: String,
        keyHighlights: [String],
      },

      // Detailed breakdown
      timeline: [
        {
          phase: String,
          timeframe: String,
          tasks: [
            {
              task: String,
              description: String,
              priority: {
                type: String,
                enum: ["low", "medium", "high", "critical"],
              },
              estimatedDuration: String,
              dependencies: [String],
              assignedTo: String,
              status: {
                type: String,
                enum: ["pending", "in_progress", "completed"],
                default: "pending",
              },
            },
          ],
        },
      ],

      // Budget breakdown
      budgetBreakdown: {
        totalEstimate: Number,
        currency: String,
        categories: [
          {
            category: String,
            subcategories: [
              {
                item: String,
                estimatedCost: Number,
                priority: String,
                notes: String,
              },
            ],
            totalCost: Number,
            percentage: Number,
          },
        ],
        contingency: {
          percentage: Number,
          amount: Number,
          reason: String,
        },
      },

      // Vendor recommendations
      vendorRecommendations: [
        {
          category: String,
          vendors: [
            {
              vendorId: mongoose.Schema.Types.ObjectId,
              name: String,
              rating: Number,
              estimatedCost: Number,
              whyRecommended: String,
              alternativeOptions: [String],
            },
          ],
        },
      ],

      // Visual and design suggestions
      visualSuggestions: {
        colorPalette: [String],
        decorThemes: [String],
        layoutSuggestions: [String],
        moodBoard: [String], // URLs to inspiration images
        designElements: [String],
      },

      // Logistics and coordination
      logistics: {
        setupTimeline: [
          {
            task: String,
            startTime: String,
            duration: String,
            team: [String],
          },
        ],
        equipmentNeeds: [String],
        staffingRequirements: [
          {
            role: String,
            count: Number,
            skills: [String],
            duration: String,
          },
        ],
        contingencyPlans: [
          {
            scenario: String,
            solution: String,
            resources: [String],
          },
        ],
      },

      // Risk assessment and mitigation
      riskAssessment: [
        {
          risk: String,
          probability: { type: String, enum: ["low", "medium", "high"] },
          impact: { type: String, enum: ["low", "medium", "high"] },
          mitigation: String,
          contingency: String,
        },
      ],

      // Success metrics and KPIs
      successMetrics: [
        {
          metric: String,
          target: String,
          measurement: String,
        },
      ],
    },

    // Plan refinement history
    refinementHistory: [
      {
        timestamp: { type: Date, default: Date.now },
        refinementType: {
          type: String,
          enum: [
            "budget_adjustment",
            "timeline_change",
            "vendor_swap",
            "requirement_update",
            "style_change",
          ],
        },
        userPrompt: String,
        aiResponse: mongoose.Schema.Types.Mixed,
        changes: mongoose.Schema.Types.Mixed,
        reasoning: String,
      },
    ],

    // User interactions and feedback
    interactions: [
      {
        timestamp: { type: Date, default: Date.now },
        interactionType: {
          type: String,
          enum: [
            "view",
            "edit",
            "share",
            "export",
            "feedback",
            "refinement_request",
          ],
        },
        details: mongoose.Schema.Types.Mixed,
        userAgent: String,
        ipAddress: String,
      },
    ],

    // Plan status and lifecycle
    status: {
      type: String,
      enum: [
        "draft",
        "active",
        "refined",
        "finalized",
        "archived",
        "cancelled",
      ],
      default: "draft",
    },

    // Collaboration and sharing
    sharing: {
      isShared: { type: Boolean, default: false },
      shareToken: String,
      sharedWith: [
        {
          email: String,
          role: { type: String, enum: ["view", "comment", "edit"] },
          sharedAt: { type: Date, default: Date.now },
        },
      ],
      publicLink: String,
    },

    // Auto-save and persistence settings
    autoSave: {
      enabled: { type: Boolean, default: true },
      frequency: { type: Number, default: 300000 }, // 5 minutes in milliseconds
      lastAutoSave: Date,
    },

    // Plan metadata
    metadata: {
      aiModel: String,
      aiVersion: String,
      processingTime: Number,
      complexity: {
        type: String,
        enum: ["simple", "moderate", "complex", "enterprise"],
      },
      confidence: { type: Number, min: 0, max: 1 },
      planLevel: Number, // Based on user subscription
      featuresUsed: [String],
    },

    // Analytics and insights
    analytics: {
      viewCount: { type: Number, default: 0 },
      editCount: { type: Number, default: 0 },
      shareCount: { type: Number, default: 0 },
      exportCount: { type: Number, default: 0 },
      lastAccessed: Date,
      timeSpent: { type: Number, default: 0 }, // in seconds
      completionRate: { type: Number, min: 0, max: 1, default: 0 },
    },

    // Tags and categorization
    tags: [String],
    category: String,
    eventCategory: String,

    // Expiration and cleanup
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 },
    },

    // Audit trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModified: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
aiPlanSchema.index({ userId: 1, status: 1, createdAt: -1 });
aiPlanSchema.index({ sessionId: 1, createdAt: -1 });
aiPlanSchema.index({ planId: 1 }, { unique: true });
aiPlanSchema.index({ userType: 1, status: 1 });
aiPlanSchema.index({ "sharing.shareToken": 1 }, { sparse: true });
aiPlanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes
aiPlanSchema.index({ userId: 1, userType: 1, status: 1, createdAt: -1 });

// Virtual for plan progress
aiPlanSchema.virtual("progress").get(function () {
  if (!this.aiPlan.timeline) return 0;

  const totalTasks = this.aiPlan.timeline.reduce(
    (sum, phase) => sum + (phase.tasks?.length || 0),
    0
  );
  const completedTasks = this.aiPlan.timeline.reduce(
    (sum, phase) =>
      sum +
      (phase.tasks?.filter((task) => task.status === "completed").length || 0),
    0
  );

  return totalTasks > 0 ? completedTasks / totalTasks : 0;
});

// Virtual for plan complexity score
aiPlanSchema.virtual("complexityScore").get(function () {
  let score = 0;

  if (this.aiPlan.timeline?.length > 5) score += 2;
  if (this.originalRequest.guestCount > 100) score += 2;
  if (this.originalRequest.budget?.amount > 1000000) score += 2;
  if (this.aiPlan.vendorRecommendations?.length > 10) score += 1;
  if (this.refinementHistory?.length > 5) score += 1;

  return score;
});

// Methods
aiPlanSchema.methods.addInteraction = function (interactionData) {
  this.interactions.push({
    ...interactionData,
    timestamp: new Date(),
  });

  this.analytics.lastAccessed = new Date();

  if (interactionData.interactionType === "view") {
    this.analytics.viewCount += 1;
  } else if (interactionData.interactionType === "edit") {
    this.analytics.editCount += 1;
  } else if (interactionData.interactionType === "share") {
    this.analytics.shareCount += 1;
  } else if (interactionData.interactionType === "export") {
    this.analytics.exportCount += 1;
  }
};

aiPlanSchema.methods.addRefinement = function (refinementData) {
  this.refinementHistory.push({
    ...refinementData,
    timestamp: new Date(),
  });

  this.status = "refined";
  this.lastModified = new Date();
};

aiPlanSchema.methods.generateShareToken = function () {
  const crypto = require("crypto");
  this.sharing.shareToken = crypto.randomBytes(32).toString("hex");
  this.sharing.isShared = true;
  return this.sharing.shareToken;
};

aiPlanSchema.methods.canUserAccess = function (userId, userType) {
  // Owner can always access
  if (this.userId.toString() === userId.toString()) return true;

  // Check if shared with specific user
  if (
    this.sharing.isShared &&
    this.sharing.sharedWith.some((share) => share.email)
  ) {
    return true; // Would need email check in real implementation
  }

  return false;
};

aiPlanSchema.methods.updateProgress = function () {
  this.analytics.completionRate = this.progress;
};

// Static methods
aiPlanSchema.statics.findByUser = function (userId, userType, options = {}) {
  const query = { userId, userType };

  if (options.status) query.status = options.status;
  if (options.category) query.category = options.category;

  return this.find(query)
    .sort({ lastModified: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0);
};

aiPlanSchema.statics.findActiveForUser = function (userId, userType) {
  return this.find({
    userId,
    userType,
    status: { $in: ["draft", "active", "refined"] },
  }).sort({ lastModified: -1 });
};

aiPlanSchema.statics.findBySession = function (sessionId) {
  return this.find({ sessionId }).sort({ createdAt: -1 });
};

aiPlanSchema.statics.getRecentPlans = function (userId, userType, limit = 5) {
  return this.find({ userId, userType })
    .sort({ lastModified: -1 })
    .limit(limit)
    .select("planId title status lastModified analytics.lastAccessed");
};

// Pre-save middleware
aiPlanSchema.pre("save", function (next) {
  // Generate planId if not exists
  if (!this.planId) {
    this.planId = `plan_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  // Set expiration for guest plans (7 days)
  if (this.userType === "guest" && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  // Update progress
  this.updateProgress();

  this.lastModified = new Date();
  next();
});

// Post-save middleware for auto-save tracking
aiPlanSchema.post("save", function () {
  if (this.autoSave.enabled) {
    this.autoSave.lastAutoSave = new Date();
  }
});

const AIPlan = mongoose.model("AIPlan", aiPlanSchema);

export default AIPlan;
