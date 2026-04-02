import mongoose from "mongoose";

const eventPlanTemplateSchema = new mongoose.Schema(
  {
    templateId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    eventType: {
      type: String,
      required: true,
      enum: [
        "wedding",
        "birthday",
        "corporate",
        "social",
        "conference",
        "exhibition",
        "other",
      ],
      index: true,
    },

    category: {
      type: String,
      enum: ["basic", "premium", "luxury", "custom"],
      default: "basic",
    },

    // Template structure
    template: {
      // Budget allocation template
      budgetAllocation: [
        {
          category: String,
          percentage: { type: Number, min: 0, max: 100 },
          priority: {
            type: String,
            enum: ["essential", "important", "optional"],
          },
          description: String,
        },
      ],

      // Timeline template
      timeline: [
        {
          phase: String,
          daysBeforeEvent: Number,
          tasks: [String],
          dependencies: [String],
          criticalPath: Boolean,
        },
      ],

      // Vendor categories template
      vendorCategories: [
        {
          category: String,
          required: Boolean,
          priority: Number,
          estimatedBudgetPercentage: Number,
          specifications: [String],
        },
      ],

      // Checklist template
      checklist: [
        {
          category: String,
          items: [
            {
              task: String,
              daysBeforeEvent: Number,
              priority: { type: String, enum: ["high", "medium", "low"] },
              estimatedDuration: String,
              dependencies: [String],
            },
          ],
        },
      ],

      // Visual guidelines
      visualGuidelines: {
        colorPalettes: [String],
        themes: [String],
        styleKeywords: [String],
        moodBoardElements: [String],
      },

      // Risk factors and mitigation
      riskFactors: [
        {
          risk: String,
          probability: { type: String, enum: ["low", "medium", "high"] },
          impact: { type: String, enum: ["low", "medium", "high"] },
          mitigation: String,
        },
      ],
    },

    // Template metadata
    metadata: {
      guestCountRange: {
        min: Number,
        max: Number,
      },
      budgetRange: {
        min: Number,
        max: Number,
        currency: String,
      },
      duration: {
        min: Number, // in hours
        max: Number,
      },
      seasonality: [String], // spring, summer, fall, winter
      locations: [String], // indoor, outdoor, venue-specific
      complexity: { type: String, enum: ["simple", "moderate", "complex"] },
    },

    // AI enhancement data
    aiEnhancements: {
      successRate: { type: Number, min: 0, max: 1, default: 0 },
      usageCount: { type: Number, default: 0 },
      averageRating: { type: Number, min: 0, max: 5, default: 0 },
      lastOptimized: Date,

      // Machine learning features
      features: mongoose.Schema.Types.Mixed,
      performanceMetrics: {
        accuracy: Number,
        clientSatisfaction: Number,
        budgetAccuracy: Number,
        timelineAccuracy: Number,
      },
    },

    // Customization options
    customizationOptions: {
      budgetFlexibility: { type: Number, min: 0, max: 1, default: 0.2 },
      timelineFlexibility: { type: Number, min: 0, max: 1, default: 0.1 },
      vendorSubstitutions: Boolean,
      themeVariations: [String],
    },

    // Template relationships
    parentTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventPlanTemplate",
    },

    variations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EventPlanTemplate",
      },
    ],

    // Access control
    visibility: {
      type: String,
      enum: ["public", "premium", "enterprise", "private"],
      default: "public",
    },

    requiredPlanLevel: {
      type: Number,
      min: 1,
      max: 5,
      default: 1,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Status and versioning
    status: {
      type: String,
      enum: ["draft", "active", "deprecated", "archived"],
      default: "draft",
    },

    version: {
      type: String,
      default: "1.0",
    },

    isActive: { type: Boolean, default: true },

    // Analytics
    analytics: {
      totalUsage: { type: Number, default: 0 },
      successfulEvents: { type: Number, default: 0 },
      averageBudgetAccuracy: { type: Number, default: 0 },
      averageTimelineAccuracy: { type: Number, default: 0 },
      userFeedback: [
        {
          rating: { type: Number, min: 1, max: 5 },
          comment: String,
          vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
eventPlanTemplateSchema.index({ eventType: 1, category: 1, isActive: 1 });
eventPlanTemplateSchema.index({ "aiEnhancements.successRate": -1 });
eventPlanTemplateSchema.index({ "analytics.totalUsage": -1 });
eventPlanTemplateSchema.index({ requiredPlanLevel: 1, visibility: 1 });

// Virtuals
eventPlanTemplateSchema.virtual("successRate").get(function () {
  if (this.analytics.totalUsage === 0) return 0;
  return this.analytics.successfulEvents / this.analytics.totalUsage;
});

eventPlanTemplateSchema.virtual("popularityScore").get(function () {
  const usageWeight = 0.4;
  const ratingWeight = 0.3;
  const successWeight = 0.3;

  const normalizedUsage = Math.min(this.analytics.totalUsage / 100, 1);
  const normalizedRating = (this.aiEnhancements.averageRating || 0) / 5;
  const normalizedSuccess = this.successRate;

  return (
    normalizedUsage * usageWeight +
    normalizedRating * ratingWeight +
    normalizedSuccess * successWeight
  );
});

// Methods
eventPlanTemplateSchema.methods.customize = function (customizations) {
  const customizedTemplate = JSON.parse(JSON.stringify(this.template));

  // Apply budget customizations
  if (customizations.budgetAdjustments) {
    customizedTemplate.budgetAllocation =
      customizedTemplate.budgetAllocation.map((item) => {
        const adjustment = customizations.budgetAdjustments[item.category];
        if (adjustment) {
          item.percentage = Math.max(
            0,
            Math.min(100, item.percentage + adjustment)
          );
        }
        return item;
      });
  }

  // Apply timeline customizations
  if (customizations.timelineAdjustments) {
    customizedTemplate.timeline = customizedTemplate.timeline.map((phase) => {
      const adjustment = customizations.timelineAdjustments[phase.phase];
      if (adjustment) {
        phase.daysBeforeEvent = Math.max(1, phase.daysBeforeEvent + adjustment);
      }
      return phase;
    });
  }

  return customizedTemplate;
};

eventPlanTemplateSchema.methods.addFeedback = function (feedback) {
  this.analytics.userFeedback.push(feedback);

  // Recalculate average rating
  const ratings = this.analytics.userFeedback.map((f) => f.rating);
  this.aiEnhancements.averageRating =
    ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;

  return this.save();
};

eventPlanTemplateSchema.methods.recordUsage = function (successful = false) {
  this.analytics.totalUsage += 1;
  this.aiEnhancements.usageCount += 1;

  if (successful) {
    this.analytics.successfulEvents += 1;
  }

  // Update success rate
  this.aiEnhancements.successRate =
    this.analytics.successfulEvents / this.analytics.totalUsage;

  return this.save();
};

eventPlanTemplateSchema.methods.optimize = async function (optimizationData) {
  // AI-based template optimization
  if (optimizationData.budgetAccuracy) {
    this.analytics.averageBudgetAccuracy =
      (this.analytics.averageBudgetAccuracy + optimizationData.budgetAccuracy) /
      2;
  }

  if (optimizationData.timelineAccuracy) {
    this.analytics.averageTimelineAccuracy =
      (this.analytics.averageTimelineAccuracy +
        optimizationData.timelineAccuracy) /
      2;
  }

  this.aiEnhancements.lastOptimized = new Date();

  return this.save();
};

// Static methods
eventPlanTemplateSchema.statics.findByEventType = function (
  eventType,
  planLevel = 1
) {
  return this.find({
    eventType,
    isActive: true,
    requiredPlanLevel: { $lte: planLevel },
  }).sort({ "aiEnhancements.successRate": -1, "analytics.totalUsage": -1 });
};

eventPlanTemplateSchema.statics.getPopularTemplates = function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ "analytics.totalUsage": -1, "aiEnhancements.averageRating": -1 })
    .limit(limit);
};

eventPlanTemplateSchema.statics.getRecommendedTemplates = function (criteria) {
  const query = { isActive: true };

  if (criteria.eventType) query.eventType = criteria.eventType;
  if (criteria.planLevel)
    query.requiredPlanLevel = { $lte: criteria.planLevel };
  if (criteria.guestCount) {
    query.$or = [
      { "metadata.guestCountRange": { $exists: false } },
      {
        "metadata.guestCountRange.min": { $lte: criteria.guestCount },
        "metadata.guestCountRange.max": { $gte: criteria.guestCount },
      },
    ];
  }

  return this.find(query).sort({ "aiEnhancements.successRate": -1 }).limit(5);
};

eventPlanTemplateSchema.statics.createFromSuccessfulEvent = async function (
  eventData
) {
  const template = new this({
    templateId: `template_${Date.now()}`,
    name: `${eventData.eventType} Template - ${eventData.name}`,
    description: `Auto-generated template based on successful ${eventData.eventType} event`,
    eventType: eventData.eventType,
    category: "custom",
    template: {
      budgetAllocation: eventData.budgetBreakdown,
      timeline: eventData.timeline,
      vendorCategories: eventData.vendorCategories,
      checklist: eventData.checklist,
    },
    metadata: {
      guestCountRange: {
        min: Math.max(1, eventData.guestCount - 20),
        max: eventData.guestCount + 20,
      },
      budgetRange: {
        min: eventData.budget.amount * 0.8,
        max: eventData.budget.amount * 1.2,
        currency: eventData.budget.currency,
      },
    },
    aiEnhancements: {
      successRate: 1.0,
      usageCount: 1,
    },
    createdBy: eventData.createdBy,
    status: "active",
  });

  return template.save();
};

const EventPlanTemplate = mongoose.model(
  "EventPlanTemplate",
  eventPlanTemplateSchema
);

export default EventPlanTemplate;
