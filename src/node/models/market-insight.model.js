import mongoose from "mongoose";

const marketInsightSchema = new mongoose.Schema(
  {
    insightId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Geographic scope
    location: {
      city: { type: String, required: true },
      state: String,
      country: { type: String, required: true },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
      marketSize: { type: String, enum: ["small", "medium", "large", "metro"] },
    },

    // Market segment
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
        "all",
      ],
      index: true,
    },

    // Time period
    timeframe: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      period: {
        type: String,
        enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
      },
    },

    // Market data
    marketData: {
      // Demand metrics
      demand: {
        totalEvents: Number,
        averageGuestCount: Number,
        peakSeasons: [String],
        growthRate: Number, // percentage
        demandScore: { type: Number, min: 0, max: 100 },
      },

      // Supply metrics
      supply: {
        totalVendors: Number,
        activeVendors: Number,
        newVendors: Number,
        vendorsByCategory: mongoose.Schema.Types.Mixed,
        capacityUtilization: Number, // percentage
        supplyScore: { type: Number, min: 0, max: 100 },
      },

      // Pricing insights
      pricing: {
        averageBudget: {
          amount: Number,
          currency: String,
        },
        budgetRanges: [
          {
            range: String, // e.g., "10k-25k"
            percentage: Number,
            averageAmount: Number,
          },
        ],
        priceInflation: Number, // percentage
        seasonalPricing: mongoose.Schema.Types.Mixed,
        pricingTrends: {
          trend: { type: String, enum: ["increasing", "decreasing", "stable"] },
          confidence: { type: Number, min: 0, max: 1 },
        },
      },

      // Competition analysis
      competition: {
        competitionLevel: { type: String, enum: ["low", "medium", "high"] },
        marketLeaders: [String],
        averageRating: Number,
        serviceGaps: [String],
        opportunityAreas: [String],
      },
    },

    // AI-generated insights
    aiInsights: {
      // Market opportunities
      opportunities: [
        {
          opportunity: String,
          potential: { type: String, enum: ["low", "medium", "high"] },
          timeframe: String,
          requirements: [String],
          estimatedROI: Number,
        },
      ],

      // Risk factors
      risks: [
        {
          risk: String,
          probability: { type: String, enum: ["low", "medium", "high"] },
          impact: { type: String, enum: ["low", "medium", "high"] },
          mitigation: String,
        },
      ],

      // Trend predictions
      predictions: [
        {
          prediction: String,
          confidence: { type: Number, min: 0, max: 1 },
          timeframe: String,
          impact: String,
        },
      ],

      // Strategic recommendations
      recommendations: [
        {
          recommendation: String,
          priority: { type: String, enum: ["low", "medium", "high"] },
          category: String,
          expectedOutcome: String,
        },
      ],
    },

    // Trend analysis
    trends: {
      // Seasonal trends
      seasonal: {
        spring: { demand: Number, pricing: Number },
        summer: { demand: Number, pricing: Number },
        fall: { demand: Number, pricing: Number },
        winter: { demand: Number, pricing: Number },
      },

      // Monthly trends
      monthly: [
        {
          month: String,
          demandIndex: Number,
          pricingIndex: Number,
          events: Number,
        },
      ],

      // Emerging trends
      emerging: [
        {
          trend: String,
          adoptionRate: Number,
          growthPotential: { type: String, enum: ["low", "medium", "high"] },
          description: String,
        },
      ],
    },

    // Competitive landscape
    competitiveLandscape: {
      topVendors: [
        {
          vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
          marketShare: Number,
          averageRating: Number,
          priceRange: String,
          specialties: [String],
        },
      ],

      marketConcentration: {
        hhi: Number, // Herfindahl-Hirschman Index
        level: {
          type: String,
          enum: ["fragmented", "moderate", "concentrated"],
        },
      },

      barrierToEntry: {
        level: { type: String, enum: ["low", "medium", "high"] },
        factors: [String],
      },
    },

    // Data sources and quality
    dataSources: [
      {
        source: String,
        type: { type: String, enum: ["internal", "external", "api", "survey"] },
        reliability: { type: Number, min: 0, max: 1 },
        lastUpdated: Date,
      },
    ],

    dataQuality: {
      completeness: { type: Number, min: 0, max: 1 },
      accuracy: { type: Number, min: 0, max: 1 },
      freshness: { type: Number, min: 0, max: 1 },
      overallScore: { type: Number, min: 0, max: 1 },
    },

    // Analysis metadata
    analysisMetadata: {
      generatedBy: { type: String, enum: ["ai", "manual", "hybrid"] },
      aiModel: String,
      processingTime: Number, // milliseconds
      confidence: { type: Number, min: 0, max: 1 },
      version: { type: String, default: "1.0" },
    },

    // Status and lifecycle
    status: {
      type: String,
      enum: ["generating", "active", "stale", "archived"],
      default: "generating",
    },

    expiresAt: Date,

    // Usage tracking
    usage: {
      viewCount: { type: Number, default: 0 },
      downloadCount: { type: Number, default: 0 },
      shareCount: { type: Number, default: 0 },
      lastAccessed: Date,
    },

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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
marketInsightSchema.index({
  "location.city": 1,
  "location.country": 1,
  eventType: 1,
  status: 1,
});
marketInsightSchema.index({ "timeframe.startDate": 1, "timeframe.endDate": 1 });
marketInsightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
marketInsightSchema.index({ "analysisMetadata.confidence": -1 });
marketInsightSchema.index({ requiredPlanLevel: 1, visibility: 1 });

// Virtuals
marketInsightSchema.virtual("marketScore").get(function () {
  const demand = this.marketData.demand.demandScore || 0;
  const supply = this.marketData.supply.supplyScore || 0;
  const competition =
    this.competitiveLandscape.marketConcentration.level === "fragmented"
      ? 80
      : this.competitiveLandscape.marketConcentration.level === "moderate"
      ? 60
      : 40;

  return demand * 0.4 + supply * 0.3 + competition * 0.3;
});

marketInsightSchema.virtual("opportunityScore").get(function () {
  const opportunities = this.aiInsights.opportunities || [];
  const highPotential = opportunities.filter(
    (o) => o.potential === "high"
  ).length;
  const mediumPotential = opportunities.filter(
    (o) => o.potential === "medium"
  ).length;

  return Math.min(100, highPotential * 30 + mediumPotential * 15);
});

marketInsightSchema.virtual("riskScore").get(function () {
  const risks = this.aiInsights.risks || [];
  const highRisk = risks.filter(
    (r) => r.probability === "high" && r.impact === "high"
  ).length;
  const mediumRisk = risks.filter(
    (r) =>
      (r.probability === "high" && r.impact === "medium") ||
      (r.probability === "medium" && r.impact === "high")
  ).length;

  return Math.min(100, highRisk * 25 + mediumRisk * 15);
});

// Methods
marketInsightSchema.methods.updateUsage = function (action) {
  switch (action) {
    case "view":
      this.usage.viewCount += 1;
      break;
    case "download":
      this.usage.downloadCount += 1;
      break;
    case "share":
      this.usage.shareCount += 1;
      break;
  }
  this.usage.lastAccessed = new Date();
  return this.save();
};

marketInsightSchema.methods.isStale = function () {
  const now = new Date();
  const daysSinceUpdate = (now - this.updatedAt) / (1000 * 60 * 60 * 24);

  // Different staleness thresholds based on period
  const thresholds = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    yearly: 365,
  };

  return daysSinceUpdate > (thresholds[this.timeframe.period] || 30);
};

marketInsightSchema.methods.generateSummary = function () {
  return {
    location: `${this.location.city}, ${this.location.country}`,
    eventType: this.eventType,
    marketScore: this.marketScore,
    opportunityScore: this.opportunityScore,
    riskScore: this.riskScore,
    topOpportunity: this.aiInsights.opportunities?.[0]?.opportunity,
    topRisk: this.aiInsights.risks?.[0]?.risk,
    confidence: this.analysisMetadata.confidence,
    freshness: this.isStale() ? "stale" : "fresh",
  };
};

// Static methods
marketInsightSchema.statics.findByLocation = function (
  city,
  country,
  eventType = "all"
) {
  return this.find({
    "location.city": new RegExp(city, "i"),
    "location.country": new RegExp(country, "i"),
    eventType: { $in: [eventType, "all"] },
    status: "active",
  }).sort({ "analysisMetadata.confidence": -1, updatedAt: -1 });
};

marketInsightSchema.statics.getLatestInsights = function (limit = 10) {
  return this.find({ status: "active" })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select(
      "insightId location eventType marketScore opportunityScore updatedAt"
    );
};

marketInsightSchema.statics.findStaleInsights = function () {
  return this.find({ status: "active" }).then((insights) =>
    insights.filter((insight) => insight.isStale())
  );
};

marketInsightSchema.statics.getMarketOpportunities = function (planLevel = 1) {
  return this.aggregate([
    { $match: { status: "active", requiredPlanLevel: { $lte: planLevel } } },
    { $unwind: "$aiInsights.opportunities" },
    {
      $match: {
        "aiInsights.opportunities.potential": { $in: ["medium", "high"] },
      },
    },
    { $sort: { "aiInsights.opportunities.estimatedROI": -1 } },
    { $limit: 20 },
    {
      $project: {
        location: "$location",
        eventType: "$eventType",
        opportunity: "$aiInsights.opportunities",
        marketScore: { $literal: "$marketScore" },
      },
    },
  ]);
};

// Pre-save middleware
marketInsightSchema.pre("save", function (next) {
  // Auto-generate insightId if not provided
  if (!this.insightId) {
    this.insightId = `insight_${this.location.city}_${
      this.eventType
    }_${Date.now()}`;
  }

  // Set expiration date based on period
  if (!this.expiresAt) {
    const expirationDays = {
      daily: 7,
      weekly: 30,
      monthly: 90,
      quarterly: 365,
      yearly: 730,
    };

    const days = expirationDays[this.timeframe.period] || 90;
    this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  // Update status based on staleness
  if (this.isStale()) {
    this.status = "stale";
  }

  next();
});

const MarketInsight = mongoose.model("MarketInsight", marketInsightSchema);

export default MarketInsight;
