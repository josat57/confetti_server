import crypto from "crypto";
import VendorService from "./vendor.service.js";
import BudgetService from "./budget.service.js";
import CategoryService from "./category.service.js";
import TimelineService from "./timeline.service.js";
import CurrencyService from "./currency.service.js";
import PythonService from "./python.service.js";
import CacheService from "./cache.service.js";
import AIEventPlanRequest from "../models/ai-event-plan-request.model.js";
import AIEventPlanResult from "../models/ai-event-plan-result.model.js";
import InputSanitizer from "../utils/input-sanitizer.js";
import { logger } from "../utils/logger.js";
import {
  ProcessingTimeoutError,
  AIServiceUnavailableError,
} from "../utils/ai-planner-errors.js";

/**
 * Main orchestrator for AI event plan analysis
 */
class AIAnalysisService {
  constructor() {
    this.sessionTTL = 86400; // 24 hours in seconds
    this.maxProcessingTime = 30000; // 30 seconds
  }

  /**
   * Process event request and generate AI-powered event plan
   * @param {Object} rawRequest - Raw request data from user
   * @param {string} ipAddress - Client IP address
   * @param {string} userAgent - Client user agent
   * @returns {Promise<Object>} Session token and teaser result
   */
  async processEventRequest(rawRequest, ipAddress = null, userAgent = null) {
    const startTime = Date.now();
    let requestDoc = null;

    try {
      // 1. Sanitize and validate input
      logger.info("Starting event plan analysis", {
        eventType: rawRequest.eventType,
        guestCount: rawRequest.guestCount,
        budget: rawRequest.budget?.amount,
      });

      const sanitizedRequest = InputSanitizer.sanitizeEventRequest(rawRequest);

      // 2. Validate budget sufficiency
      BudgetService.validateBudgetSufficiency(
        sanitizedRequest.budget,
        sanitizedRequest.eventType,
        sanitizedRequest.guestCount
      );

      // 3. Generate session token
      const sessionToken = this.generateSessionToken();

      // 4. Save request to database
      const expiresAt = new Date(Date.now() + this.sessionTTL * 1000);
      requestDoc = await AIEventPlanRequest.create({
        sessionToken,
        eventType: sanitizedRequest.eventType,
        eventDate: sanitizedRequest.eventDate,
        guestCount: sanitizedRequest.guestCount,
        location: sanitizedRequest.location,
        eventDescription: sanitizedRequest.eventDescription,
        guestClass: sanitizedRequest.guestClass,
        budget: sanitizedRequest.budget,
        status: "processing",
        ipAddress: InputSanitizer.sanitizeIP(ipAddress),
        userAgent: InputSanitizer.sanitizeUserAgent(userAgent),
        expiresAt,
      });

      // 5. Convert budget to NGN for processing
      const budgetInNGN = await CurrencyService.convert(
        sanitizedRequest.budget.amount,
        sanitizedRequest.budget.currency,
        "NGN"
      );

      // 6. Aggregate vendor data
      const vendorData = await VendorService.aggregateVendorData(
        sanitizedRequest.location,
        sanitizedRequest.eventType
      );

      // 7. Prepare payload for Python ML API
      const pythonPayload = {
        event_data: {
          eventType: sanitizedRequest.eventType,
          eventDate: sanitizedRequest.eventDate,
          guestCount: sanitizedRequest.guestCount,
          location: sanitizedRequest.location,
          eventDescription: sanitizedRequest.eventDescription,
          guestClass: sanitizedRequest.guestClass,
          budget: budgetInNGN,
          currency: "NGN",
        },
        vendors: vendorData.vendors,
        vendor_statistics: vendorData.statistics,
      };

      // 8. Call Python ML API for AI analysis
      let pythonAnalysis;
      try {
        pythonAnalysis = await PythonService.analyzeEventPlan(pythonPayload);
      } catch (error) {
        // If Python service fails, use fallback local processing
        logger.warn("Python AI service failed, using fallback processing", {
          error: error.message,
        });
        pythonAnalysis = await this.fallbackAnalysis(
          sanitizedRequest,
          budgetInNGN,
          vendorData
        );
      }

      // 9. Optimize budget using local service (enhanced by Python results)
      const budgetAllocation = await BudgetService.optimizeBudget(
        { amount: budgetInNGN, currency: "NGN" },
        sanitizedRequest.eventType,
        sanitizedRequest.guestCount,
        vendorData
      );

      // 10. Generate category recommendations
      const categories = await CategoryService.recommendCategories(
        sanitizedRequest.eventType,
        sanitizedRequest.guestClass,
        budgetAllocation
      );

      // Update vendor counts
      const categoriesWithCounts = CategoryService.updateVendorCounts(
        categories,
        vendorData
      );

      // 11. Generate timeline
      const timeline = await TimelineService.generateTimeline(
        sanitizedRequest.eventDate,
        sanitizedRequest.eventType,
        budgetAllocation.categories
      );

      // 12. Convert budget back to user's currency
      const budgetInUserCurrency =
        await CurrencyService.convertBudgetAllocation(
          budgetAllocation,
          sanitizedRequest.budget.currency
        );

      // 13. Synthesize complete event plan
      const eventPlan = this.synthesizePlan({
        request: sanitizedRequest,
        vendorData,
        pythonAnalysis,
        budgetAllocation: budgetInUserCurrency,
        categories: categoriesWithCounts,
        timeline,
      });

      // 14. Create teaser result
      const teaserResult = this.createTeaser(eventPlan);

      // 15. Save result to database
      const resultDoc = await AIEventPlanResult.create({
        requestId: requestDoc._id,
        sessionToken,
        teaserData: teaserResult,
        analysisMetadata: {
          processingTimeMs: Date.now() - startTime,
          feasibilityScore: budgetAllocation.feasibilityScore,
          vendorsAnalyzed: vendorData.vendors.length,
          aiModelVersion: "1.0",
          pythonServiceVersion: pythonAnalysis?.version || "fallback",
        },
        status: "teaser",
      });

      // 16. Cache the result
      await CacheService.set(
        `ai-plan:${sessionToken}`,
        {
          teaser: teaserResult,
          requestId: requestDoc._id,
          resultId: resultDoc._id,
        },
        this.sessionTTL
      );

      // 17. Update request status
      requestDoc.status = "completed";
      await requestDoc.save();

      const totalTime = Date.now() - startTime;
      logger.info("Event plan analysis completed successfully", {
        sessionToken,
        eventType: sanitizedRequest.eventType,
        guestCount: sanitizedRequest.guestCount,
        budget: sanitizedRequest.budget.amount,
        currency: sanitizedRequest.budget.currency,
        feasibilityScore: budgetAllocation.feasibilityScore,
        vendorsFound: vendorData.vendors.length,
        processingTime: totalTime,
      });

      return {
        sessionToken,
        eventPlan: teaserResult,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      // Update request status to failed if it exists
      if (requestDoc) {
        requestDoc.status = "failed";
        await requestDoc
          .save()
          .catch((err) =>
            logger.error("Failed to update request status:", err)
          );
      }

      logger.error("Event plan analysis failed:", {
        error: error.message,
        stack: error.stack,
        processingTime: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Fallback analysis when Python service is unavailable
   * @param {Object} request - Sanitized request
   * @param {number} budgetInNGN - Budget in NGN
   * @param {Object} vendorData - Vendor data
   * @returns {Promise<Object>} Fallback analysis
   */
  async fallbackAnalysis(request, budgetInNGN, vendorData) {
    logger.info("Using fallback analysis");

    return {
      nlp_analysis: {
        sentiment: { score: 0.7, label: "positive" },
        keywords: this.extractKeywords(request.eventDescription),
        event_insights: `${request.eventType} event for ${request.guestCount} guests`,
      },
      budget_optimization: {
        feasibility_score: 75,
        recommendations: [
          "Consider booking vendors early for better rates",
          "Allocate sufficient budget for essential categories",
        ],
      },
      vendor_matches: {
        total_matches: vendorData.vendors.length,
        categories: vendorData.statistics.categoryCounts,
      },
      recommendations: {
        budget_tips: ["Plan for contingency expenses"],
        vendor_tips: ["Compare multiple vendors before booking"],
        timeline_tips: ["Start planning as early as possible"],
      },
      version: "fallback-1.0",
    };
  }

  /**
   * Extract keywords from text (simple implementation)
   * @param {string} text - Text to analyze
   * @returns {Array} Keywords
   */
  extractKeywords(text) {
    const stopWords = [
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
    ];
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.includes(word));

    // Get unique words
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Synthesize complete event plan from all analysis results
   * @param {Object} data - All analysis data
   * @returns {Object} Complete event plan
   */
  synthesizePlan(data) {
    const {
      request,
      vendorData,
      pythonAnalysis,
      budgetAllocation,
      categories,
      timeline,
    } = data;

    return {
      eventSummary: {
        eventType: request.eventType,
        eventDate: request.eventDate,
        location: `${request.location.city}, ${request.location.state}`,
        guestCount: request.guestCount,
        totalBudget: request.budget.amount,
        currency: request.budget.currency,
        formality: request.guestClass.formality,
      },
      budgetBreakdown: {
        categories: budgetAllocation.categories.map((cat) => ({
          name: cat.name,
          category: cat.category,
          percentage: cat.percentage,
          amount: cat.allocatedAmount,
          priority: cat.priority,
          confidence: cat.confidence,
          description: cat.rationale,
        })),
        totalAllocated: budgetAllocation.totalAllocated,
        contingency: budgetAllocation.contingency,
        feasibilityScore: budgetAllocation.feasibilityScore,
      },
      vendorCategories: categories,
      timeline,
      recommendations: this.generateRecommendations(
        budgetAllocation,
        vendorData,
        pythonAnalysis
      ),
      aiInsights: {
        sentiment: pythonAnalysis?.nlp_analysis?.sentiment || {
          score: 0.7,
          label: "positive",
        },
        keywords: pythonAnalysis?.nlp_analysis?.keywords || [],
        feasibilityScore: budgetAllocation.feasibilityScore,
      },
    };
  }

  /**
   * Create teaser result (public preview)
   * @param {Object} fullPlan - Complete event plan
   * @returns {Object} Teaser result
   */
  createTeaser(fullPlan) {
    return {
      eventSummary: fullPlan.eventSummary,
      budgetBreakdown: fullPlan.budgetBreakdown,
      vendorCategories: fullPlan.vendorCategories.map((cat) => ({
        ...cat,
        locked: true, // Always locked for teaser
      })),
      timeline: {
        ...fullPlan.timeline,
        detailedTimelineLocked: true,
      },
      recommendations: fullPlan.recommendations.slice(0, 5), // Limit recommendations
      aiInsights: fullPlan.aiInsights,
    };
  }

  /**
   * Generate recommendations based on analysis
   * @param {Object} budgetAllocation - Budget allocation
   * @param {Object} vendorData - Vendor data
   * @param {Object} pythonAnalysis - Python AI analysis
   * @returns {Array} Recommendations
   */
  generateRecommendations(budgetAllocation, vendorData, pythonAnalysis) {
    const recommendations = [];

    // Budget recommendations
    if (budgetAllocation.feasibilityScore < 70) {
      recommendations.push(
        "Your budget is tight for this event. Consider reducing guest count or choosing more budget-friendly options."
      );
    } else if (budgetAllocation.feasibilityScore >= 85) {
      recommendations.push(
        "Your budget is excellent! You have flexibility to choose premium vendors."
      );
    }

    // Vendor recommendations
    if (vendorData.statistics.totalVendors < 20) {
      recommendations.push(
        "Limited vendors available in your area. Book early to secure your preferred choices."
      );
    }

    // Python AI recommendations
    if (pythonAnalysis?.recommendations) {
      if (pythonAnalysis.recommendations.budget_tips) {
        recommendations.push(
          ...pythonAnalysis.recommendations.budget_tips.slice(0, 2)
        );
      }
      if (pythonAnalysis.recommendations.vendor_tips) {
        recommendations.push(
          ...pythonAnalysis.recommendations.vendor_tips.slice(0, 2)
        );
      }
    }

    // General recommendations
    recommendations.push(
      "Sign up to unlock detailed vendor recommendations and contact information.",
      "Create an account to save your event plan and access exclusive features."
    );

    return recommendations.slice(0, 8); // Limit to 8 recommendations
  }

  /**
   * Generate unique session token
   * @returns {string} Session token
   */
  generateSessionToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Retrieve event plan by session token
   * @param {string} sessionToken - Session token
   * @returns {Promise<Object>} Event plan teaser
   */
  async getEventPlanByToken(sessionToken) {
    try {
      // Try cache first
      const cached = await CacheService.get(`ai-plan:${sessionToken}`);
      if (cached) {
        logger.info("Event plan retrieved from cache", { sessionToken });
        return {
          eventPlan: cached.teaser,
          canUpgrade: true,
        };
      }

      // Fallback to database
      const result = await AIEventPlanResult.findOne({ sessionToken })
        .populate("requestId")
        .lean();

      if (!result) {
        return null;
      }

      // Check if expired
      const request = result.requestId;
      if (request && new Date(request.expiresAt) < new Date()) {
        logger.warn("Event plan expired", { sessionToken });
        return null;
      }

      return {
        eventPlan: result.teaserData,
        canUpgrade: !result.userId, // Can upgrade if not associated with user
      };
    } catch (error) {
      logger.error("Error retrieving event plan:", {
        sessionToken,
        error: error.message,
      });
      throw error;
    }
  }
}

export default new AIAnalysisService();
