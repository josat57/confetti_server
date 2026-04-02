import Event from "../models/event.model.js";
import Vendor from "../models/vendor.model.js";
import AIPlannerUsage from "../models/ai-planner-usage.model.js";
import Subscription from "../models/subscription.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Controller for Planner AI features
 */
class PlannerAIController {
  /**
   * Generate comprehensive event plan using AI
   * POST /api/v1/planner/ai/generate-plan
   */
  async generatePlan(req, res, next) {
    try {
      const plannerId = req.user._id;
      const {
        eventType,
        date,
        location,
        guestCount,
        budget,
        guestClass,
        preferences,
      } = req.body;

      // Validate required fields
      if (!eventType || !date || !location || !guestCount || !budget) {
        throw new AppError(
          "Missing required fields: eventType, date, location, guestCount, budget",
          400
        );
      }

      // Get planner's subscription
      const subscription = await Subscription.findOne({
        user: plannerId,
        planType: "planner",
      });

      if (!subscription || !subscription.isActive()) {
        throw new AppError("Active subscription required", 403);
      }

      // Check tier limits
      const usageCheck = await AIPlannerUsage.canUseFeature(
        plannerId,
        "generate-plan",
        subscription.planName
      );

      if (!usageCheck.allowed) {
        throw new AppError(
          `AI plan generation limit reached for ${subscription.planName} tier. Upgrade to Professional or higher for unlimited access.`,
          403
        );
      }

      logger.info("Generating AI event plan", {
        plannerId,
        eventType,
        guestCount,
      });

      // Generate budget breakdown based on event type and guest count
      const budgetBreakdown = this._generateBudgetBreakdown(
        eventType,
        budget.amount,
        guestCount
      );

      // Generate vendor recommendations
      const vendorRecommendations = await this._generateVendorRecommendations(
        eventType,
        location,
        budgetBreakdown
      );

      // Generate timeline
      const timeline = this._generateTimeline(eventType, new Date(date));

      // Generate AI tips and recommendations
      const recommendations = this._generateRecommendations(
        eventType,
        guestCount,
        guestClass,
        preferences
      );

      // Increment usage
      await AIPlannerUsage.incrementUsage(plannerId, "generate-plan");

      const eventPlan = {
        summary: `Comprehensive ${eventType} event plan for ${guestCount} guests`,
        eventDetails: {
          eventType,
          date,
          location,
          guestCount,
          budget,
          guestClass: guestClass || "mixed",
        },
        budgetBreakdown,
        vendorRecommendations,
        timeline,
        recommendations,
        tips: this._generateTips(eventType),
      };

      res.status(200).json({
        success: true,
        message: "Event plan generated successfully",
        data: {
          eventPlan,
          usage: {
            remaining: usageCheck.remaining - 1,
            limit: usageCheck.limit,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get AI vendor recommendations
   * POST /api/v1/planner/ai/suggest-vendors
   */
  async suggestVendors(req, res, next) {
    try {
      const plannerId = req.user._id;
      const { eventType, location, budget, categories } = req.body;

      if (!eventType || !location) {
        throw new AppError("Missing required fields: eventType, location", 400);
      }

      // Get planner's subscription
      const subscription = await Subscription.findOne({
        user: plannerId,
        planType: "planner",
      });

      if (!subscription || !subscription.isActive()) {
        throw new AppError("Active subscription required", 403);
      }

      // Check tier limits
      const usageCheck = await AIPlannerUsage.canUseFeature(
        plannerId,
        "suggest-vendors",
        subscription.planName
      );

      if (!usageCheck.allowed) {
        throw new AppError(
          `AI vendor suggestions limit reached for ${subscription.planName} tier`,
          403
        );
      }

      logger.info("Generating AI vendor suggestions", {
        plannerId,
        eventType,
        location,
      });

      // Query vendors based on criteria
      const query = {
        isActive: true,
        "services.category": { $in: categories || [] },
      };

      // Add location filter if city is provided
      if (location.city) {
        query["businessInfo.address.city"] = new RegExp(location.city, "i");
      }

      const vendors = await Vendor.find(query)
        .select(
          "businessName services.category services.pricing rating totalReviews businessInfo.address businessInfo.phone businessInfo.email"
        )
        .limit(20)
        .lean();

      // Rank vendors by compatibility
      const rankedVendors = this._rankVendors(
        vendors,
        eventType,
        budget,
        categories
      );

      // Increment usage
      await AIPlannerUsage.incrementUsage(plannerId, "suggest-vendors");

      res.status(200).json({
        success: true,
        message: "Vendor recommendations generated successfully",
        data: {
          vendors: rankedVendors,
          usage: {
            remaining: usageCheck.remaining - 1,
            limit: usageCheck.limit,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Optimize budget allocation
   * POST /api/v1/planner/ai/optimize-budget
   */
  async optimizeBudget(req, res, next) {
    try {
      const plannerId = req.user._id;
      const { eventType, currentBudget, guestCount, priorities } = req.body;

      if (!eventType || !currentBudget || !guestCount) {
        throw new AppError(
          "Missing required fields: eventType, currentBudget, guestCount",
          400
        );
      }

      // Get planner's subscription
      const subscription = await Subscription.findOne({
        user: plannerId,
        planType: "planner",
      });

      if (!subscription || !subscription.isActive()) {
        throw new AppError("Active subscription required", 403);
      }

      // Check tier limits
      const usageCheck = await AIPlannerUsage.canUseFeature(
        plannerId,
        "optimize-budget",
        subscription.planName
      );

      if (!usageCheck.allowed) {
        throw new AppError(
          `AI budget optimization limit reached for ${subscription.planName} tier`,
          403
        );
      }

      logger.info("Optimizing budget with AI", {
        plannerId,
        eventType,
        totalBudget: currentBudget.amount,
      });

      // Generate optimized budget
      const optimizedBudget = this._optimizeBudgetAllocation(
        eventType,
        currentBudget.amount,
        guestCount,
        priorities
      );

      // Calculate savings
      const savings = this._calculateSavings(currentBudget, optimizedBudget);

      // Increment usage
      await AIPlannerUsage.incrementUsage(plannerId, "optimize-budget");

      res.status(200).json({
        success: true,
        message: "Budget optimized successfully",
        data: {
          currentBudget,
          optimizedBudget,
          savings,
          recommendations: this._generateBudgetRecommendations(
            eventType,
            optimizedBudget
          ),
          usage: {
            remaining: usageCheck.remaining - 1,
            limit: usageCheck.limit,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save AI-generated plan as event
   * POST /api/v1/planner/ai/save-plan
   */
  async savePlan(req, res, next) {
    try {
      const plannerId = req.user._id;
      const { eventPlan, title } = req.body;

      if (!eventPlan) {
        throw new AppError("Event plan data is required", 400);
      }

      logger.info("Saving AI-generated plan as event", { plannerId });

      // Create event from AI plan
      const event = await Event.create({
        title: title || `${eventPlan.eventDetails.eventType} Event`,
        description: eventPlan.summary,
        eventType: eventPlan.eventDetails.eventType,
        startDate: eventPlan.eventDetails.date,
        endDate: eventPlan.eventDetails.date,
        location: {
          address: {
            city: eventPlan.eventDetails.location.city,
            state: eventPlan.eventDetails.location.state,
            country: eventPlan.eventDetails.location.country,
          },
        },
        budget: {
          amount: eventPlan.eventDetails.budget.amount,
          currency: eventPlan.eventDetails.budget.currency || "NGN",
        },
        guestCount: eventPlan.eventDetails.guestCount,
        planner: plannerId,
        createdBy: plannerId,
        status: "draft",
      });

      res.status(201).json({
        success: true,
        message: "Event plan saved successfully",
        data: {
          eventId: event._id,
          event,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get AI usage statistics
   * GET /api/v1/planner/ai/usage
   */
  async getUsageStats(req, res, next) {
    try {
      const plannerId = req.user._id;

      // Get subscription
      const subscription = await Subscription.findOne({
        user: plannerId,
        planType: "planner",
      });

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Get usage for all types
      const usageTypes = [
        "generate-plan",
        "suggest-vendors",
        "optimize-budget",
      ];
      const usageStats = {};

      for (const type of usageTypes) {
        const check = await AIPlannerUsage.canUseFeature(
          plannerId,
          type,
          subscription.planName
        );
        usageStats[type] = check;
      }

      res.status(200).json({
        success: true,
        data: {
          planName: subscription.planName,
          usage: usageStats,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper methods

  _generateBudgetBreakdown(eventType, totalBudget, guestCount) {
    // Budget allocation percentages by event type
    const allocations = {
      wedding: {
        venue: 0.3,
        catering: 0.25,
        decoration: 0.15,
        photography: 0.1,
        entertainment: 0.1,
        other: 0.1,
      },
      birthday: {
        venue: 0.25,
        catering: 0.3,
        decoration: 0.2,
        entertainment: 0.15,
        other: 0.1,
      },
      corporate: {
        venue: 0.35,
        catering: 0.25,
        audioVisual: 0.15,
        materials: 0.15,
        other: 0.1,
      },
      social: {
        venue: 0.3,
        catering: 0.3,
        decoration: 0.15,
        entertainment: 0.15,
        other: 0.1,
      },
      other: {
        venue: 0.3,
        catering: 0.25,
        decoration: 0.15,
        entertainment: 0.15,
        other: 0.15,
      },
    };

    const allocation = allocations[eventType] || allocations.other;
    const breakdown = {};

    for (const [category, percentage] of Object.entries(allocation)) {
      breakdown[category] = {
        allocated: Math.round(totalBudget * percentage),
        percentage: Math.round(percentage * 100),
        spent: 0,
        remaining: Math.round(totalBudget * percentage),
      };
    }

    return breakdown;
  }

  async _generateVendorRecommendations(eventType, location, budgetBreakdown) {
    // Map event types to vendor categories
    const categoryMap = {
      wedding: [
        "venue",
        "catering",
        "photography",
        "decoration",
        "entertainment",
      ],
      birthday: ["venue", "catering", "decoration", "entertainment"],
      corporate: ["venue", "catering", "audioVisual"],
      social: ["venue", "catering", "decoration", "entertainment"],
      other: ["venue", "catering"],
    };

    const categories = categoryMap[eventType] || categoryMap.other;
    const recommendations = [];

    for (const category of categories) {
      const budgetForCategory = budgetBreakdown[category]?.allocated || 0;

      recommendations.push({
        category,
        suggestedBudget: budgetForCategory,
        description: `Recommended ${category} services for your ${eventType} event`,
        tips: this._getCategoryTips(category, eventType),
      });
    }

    return recommendations;
  }

  _generateTimeline(eventType, eventDate) {
    // Timeline templates by event type (days before event)
    const templates = {
      wedding: [
        { task: "Book venue", daysBeforeEvent: 180, priority: "high" },
        { task: "Hire photographer", daysBeforeEvent: 150, priority: "high" },
        { task: "Book catering", daysBeforeEvent: 120, priority: "high" },
        { task: "Send invitations", daysBeforeEvent: 60, priority: "medium" },
        {
          task: "Finalize decorations",
          daysBeforeEvent: 30,
          priority: "medium",
        },
        { task: "Confirm all vendors", daysBeforeEvent: 14, priority: "high" },
        { task: "Final walkthrough", daysBeforeEvent: 7, priority: "high" },
        { task: "Rehearsal", daysBeforeEvent: 1, priority: "medium" },
      ],
      birthday: [
        { task: "Book venue", daysBeforeEvent: 60, priority: "high" },
        { task: "Send invitations", daysBeforeEvent: 30, priority: "medium" },
        { task: "Order cake", daysBeforeEvent: 14, priority: "high" },
        {
          task: "Finalize decorations",
          daysBeforeEvent: 7,
          priority: "medium",
        },
        { task: "Confirm vendors", daysBeforeEvent: 3, priority: "high" },
      ],
      corporate: [
        { task: "Book venue", daysBeforeEvent: 90, priority: "high" },
        { task: "Arrange AV equipment", daysBeforeEvent: 60, priority: "high" },
        { task: "Send invitations", daysBeforeEvent: 45, priority: "medium" },
        { task: "Finalize catering", daysBeforeEvent: 30, priority: "high" },
        { task: "Prepare materials", daysBeforeEvent: 14, priority: "medium" },
        { task: "Confirm all vendors", daysBeforeEvent: 7, priority: "high" },
      ],
      social: [
        { task: "Book venue", daysBeforeEvent: 60, priority: "high" },
        { task: "Send invitations", daysBeforeEvent: 30, priority: "medium" },
        { task: "Arrange catering", daysBeforeEvent: 21, priority: "high" },
        {
          task: "Finalize decorations",
          daysBeforeEvent: 14,
          priority: "medium",
        },
        { task: "Confirm vendors", daysBeforeEvent: 7, priority: "high" },
      ],
    };

    const template = templates[eventType] || templates.social;

    return template.map((item) => {
      const dueDate = new Date(eventDate);
      dueDate.setDate(dueDate.getDate() - item.daysBeforeEvent);

      return {
        ...item,
        dueDate,
        status: "pending",
      };
    });
  }

  _generateRecommendations(eventType, guestCount, guestClass, preferences) {
    const recommendations = [];

    // Guest count recommendations
    if (guestCount > 200) {
      recommendations.push({
        category: "venue",
        title: "Large Venue Required",
        description: "Consider venues with capacity for 200+ guests",
        priority: "high",
      });
    }

    // Guest class recommendations
    if (guestClass === "vip" || guestClass === "luxury") {
      recommendations.push({
        category: "general",
        title: "Premium Services",
        description: "Focus on high-end vendors and premium services",
        priority: "high",
      });
    }

    // Event type specific recommendations
    if (eventType === "wedding") {
      recommendations.push({
        category: "planning",
        title: "Start Early",
        description: "Begin planning at least 6 months in advance",
        priority: "high",
      });
    }

    return recommendations;
  }

  _generateTips(eventType) {
    const tips = {
      wedding: [
        "Book your venue and key vendors at least 6 months in advance",
        "Create a detailed timeline and share it with all vendors",
        "Consider weather backup plans for outdoor venues",
        "Allocate 10-15% of budget for unexpected expenses",
      ],
      birthday: [
        "Send invitations at least 3 weeks in advance",
        "Consider the age group when planning activities",
        "Have a backup indoor option for outdoor parties",
        "Order cake at least 2 weeks in advance",
      ],
      corporate: [
        "Ensure venue has adequate AV equipment and WiFi",
        "Plan for registration and check-in process",
        "Provide clear agenda to all attendees",
        "Consider dietary restrictions for catering",
      ],
      social: [
        "Choose a venue that matches your event theme",
        "Plan entertainment that suits your guest demographic",
        "Ensure adequate parking or transportation options",
        "Have a rain plan for outdoor events",
      ],
    };

    return tips[eventType] || tips.social;
  }

  _rankVendors(vendors, eventType, budget, categories) {
    return vendors
      .map((vendor) => {
        let score = 0;

        // Rating score (0-50 points)
        score += (vendor.rating || 0) * 10;

        // Review count score (0-20 points)
        score += Math.min((vendor.totalReviews || 0) / 10, 20);

        // Category match score (0-30 points)
        const vendorCategories = vendor.services?.map((s) => s.category) || [];
        const matchCount =
          categories?.filter((c) => vendorCategories.includes(c)).length || 0;
        score += matchCount * 10;

        return {
          ...vendor,
          compatibilityScore: Math.round(score),
          matchReason: this._getMatchReason(vendor, eventType),
        };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 10);
  }

  _getMatchReason(vendor, eventType) {
    const reasons = [];

    if (vendor.rating >= 4.5) {
      reasons.push("Highly rated");
    }

    if (vendor.totalReviews > 50) {
      reasons.push("Experienced");
    }

    return reasons.join(", ") || "Good match";
  }

  _optimizeBudgetAllocation(eventType, totalBudget, guestCount, priorities) {
    // Start with base allocation
    const baseAllocation = this._generateBudgetBreakdown(
      eventType,
      totalBudget,
      guestCount
    );

    // Adjust based on priorities
    if (priorities && Array.isArray(priorities)) {
      // Increase allocation for priority categories by 10%
      priorities.forEach((category) => {
        if (baseAllocation[category]) {
          baseAllocation[category].allocated *= 1.1;
        }
      });

      // Normalize to ensure total equals budget
      const total = Object.values(baseAllocation).reduce(
        (sum, cat) => sum + cat.allocated,
        0
      );
      const factor = totalBudget / total;

      Object.keys(baseAllocation).forEach((category) => {
        baseAllocation[category].allocated = Math.round(
          baseAllocation[category].allocated * factor
        );
        baseAllocation[category].remaining = baseAllocation[category].allocated;
      });
    }

    return baseAllocation;
  }

  _calculateSavings(currentBudget, optimizedBudget) {
    // Calculate potential savings (simplified)
    const currentTotal = Object.values(currentBudget).reduce(
      (sum, cat) => sum + (cat.allocated || 0),
      0
    );
    const optimizedTotal = Object.values(optimizedBudget).reduce(
      (sum, cat) => sum + (cat.allocated || 0),
      0
    );

    return {
      amount: Math.max(0, currentTotal - optimizedTotal),
      percentage:
        currentTotal > 0
          ? Math.round(((currentTotal - optimizedTotal) / currentTotal) * 100)
          : 0,
    };
  }

  _generateBudgetRecommendations(eventType, optimizedBudget) {
    const recommendations = [];

    Object.entries(optimizedBudget).forEach(([category, data]) => {
      if (data.percentage > 35) {
        recommendations.push({
          category,
          message: `Consider reducing ${category} allocation to balance budget`,
          type: "warning",
        });
      }
    });

    return recommendations;
  }

  _getCategoryTips(category, eventType) {
    const tips = {
      venue: [
        "Visit venues in person before booking",
        "Check availability for your preferred date",
        "Ask about included amenities and restrictions",
      ],
      catering: [
        "Request tasting sessions before finalizing",
        "Discuss dietary restrictions and allergies",
        "Confirm service staff and equipment included",
      ],
      photography: [
        "Review portfolio and previous work",
        "Discuss shot list and must-have moments",
        "Clarify deliverables and timeline",
      ],
      decoration: [
        "Share inspiration photos and color schemes",
        "Discuss setup and teardown logistics",
        "Confirm what's included in the package",
      ],
      entertainment: [
        "Check availability and backup options",
        "Discuss music preferences and restrictions",
        "Confirm equipment and space requirements",
      ],
    };

    return (
      tips[category] || [
        "Research multiple options",
        "Compare quotes",
        "Read reviews",
      ]
    );
  }
}

export default new PlannerAIController();
