import VendorAIService from "../services/vendor-ai.service.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import { getPlanLevel } from "../middleware/subscription.js";

/**
 * Advanced AI Event Planner Controller for Vendors
 * Provides intelligent event planning capabilities with subscription-based features
 */
class VendorAIController {
  /**
   * Generate comprehensive event plan with AI assistance
   * POST /api/v1/vendors/ai-planner/generate
   */
  async generateEventPlan(req, res, next) {
    try {
      const startTime = Date.now();
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      logger.info("Vendor AI event plan generation started", {
        vendorId,
        planName: req.vendor.subscription.planName,
        planLevel,
      });

      const eventPlan = await VendorAIService.generateComprehensivePlan({
        ...req.body,
        vendorId,
        planLevel,
        vendorProfile: req.vendor,
      });

      const processingTime = Date.now() - startTime;

      res.status(200).json({
        status: "success",
        message: "AI event plan generated successfully",
        data: {
          eventPlan,
          planFeatures: VendorAIService.getPlanFeatures(planLevel),
          processingTime,
        },
      });
    } catch (error) {
      logger.error("Vendor AI event plan generation failed:", error);
      next(error);
    }
  }

  /**
   * Analyze client requirements with AI
   * POST /api/v1/vendors/ai-planner/analyze-client
   */
  async analyzeClientRequirements(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      const analysis = await VendorAIService.analyzeClientRequirements({
        ...req.body,
        vendorId,
        planLevel,
      });

      res.status(200).json({
        status: "success",
        data: { analysis },
      });
    } catch (error) {
      logger.error("Client requirements analysis failed:", error);
      next(error);
    }
  }

  /**
   * Generate personalized vendor recommendations
   * POST /api/v1/vendors/ai-planner/recommend-vendors
   */
  async recommendVendors(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      const recommendations =
        await VendorAIService.generateVendorRecommendations({
          ...req.body,
          requestingVendorId: vendorId,
          planLevel,
        });

      res.status(200).json({
        status: "success",
        data: { recommendations },
      });
    } catch (error) {
      logger.error("Vendor recommendations failed:", error);
      next(error);
    }
  }

  /**
   * Optimize event budget with AI
   * POST /api/v1/vendors/ai-planner/optimize-budget
   */
  async optimizeBudget(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      const optimization = await VendorAIService.optimizeEventBudget({
        ...req.body,
        vendorId,
        planLevel,
      });

      res.status(200).json({
        status: "success",
        data: { optimization },
      });
    } catch (error) {
      logger.error("Budget optimization failed:", error);
      next(error);
    }
  }

  /**
   * Generate event timeline with AI
   * POST /api/v1/vendors/ai-planner/generate-timeline
   */
  async generateTimeline(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      const timeline = await VendorAIService.generateIntelligentTimeline({
        ...req.body,
        vendorId,
        planLevel,
      });

      res.status(200).json({
        status: "success",
        data: { timeline },
      });
    } catch (error) {
      logger.error("Timeline generation failed:", error);
      next(error);
    }
  }

  /**
   * Get AI-powered market insights
   * GET /api/v1/vendors/ai-planner/market-insights
   */
  async getMarketInsights(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      const insights = await VendorAIService.generateMarketInsights({
        vendorId,
        planLevel,
        location: req.query.location,
        eventType: req.query.eventType,
        timeframe: req.query.timeframe,
      });

      res.status(200).json({
        status: "success",
        data: { insights },
      });
    } catch (error) {
      logger.error("Market insights generation failed:", error);
      next(error);
    }
  }

  /**
   * Generate AI-powered proposal
   * POST /api/v1/vendors/ai-planner/generate-proposal
   */
  async generateProposal(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      const proposal = await VendorAIService.generateIntelligentProposal({
        ...req.body,
        vendorId,
        planLevel,
        vendorProfile: req.vendor,
      });

      res.status(200).json({
        status: "success",
        data: { proposal },
      });
    } catch (error) {
      logger.error("Proposal generation failed:", error);
      next(error);
    }
  }

  /**
   * Get AI learning insights and recommendations
   * GET /api/v1/vendors/ai-planner/learning-insights
   */
  async getLearningInsights(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      const insights = await VendorAIService.generateLearningInsights({
        vendorId,
        planLevel,
      });

      res.status(200).json({
        status: "success",
        data: { insights },
      });
    } catch (error) {
      logger.error("Learning insights generation failed:", error);
      next(error);
    }
  }

  /**
   * Train AI model with vendor-specific data
   * POST /api/v1/vendors/ai-planner/train-model
   */
  async trainModel(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      // Only available for professional and enterprise plans
      if (planLevel < 4) {
        return next(
          new AppError(
            "AI model training requires Professional plan or higher",
            403
          )
        );
      }

      const trainingResult = await VendorAIService.trainVendorModel({
        vendorId,
        trainingData: req.body,
        planLevel,
      });

      res.status(200).json({
        status: "success",
        data: { trainingResult },
      });
    } catch (error) {
      logger.error("AI model training failed:", error);
      next(error);
    }
  }

  /**
   * Get AI model performance metrics
   * GET /api/v1/vendors/ai-planner/model-metrics
   */
  async getModelMetrics(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      const metrics = await VendorAIService.getModelPerformanceMetrics({
        vendorId,
        planLevel,
      });

      res.status(200).json({
        status: "success",
        data: { metrics },
      });
    } catch (error) {
      logger.error("Model metrics retrieval failed:", error);
      next(error);
    }
  }

  /**
   * Generate visual content suggestions
   * POST /api/v1/vendors/ai-planner/visual-suggestions
   */
  async generateVisualSuggestions(req, res, next) {
    try {
      const vendorId = req.vendor._id;
      const planLevel = getPlanLevel(req.vendor.subscription.planName);

      const suggestions = await VendorAIService.generateVisualSuggestions({
        ...req.body,
        vendorId,
        planLevel,
      });

      res.status(200).json({
        status: "success",
        data: { suggestions },
      });
    } catch (error) {
      logger.error("Visual suggestions generation failed:", error);
      next(error);
    }
  }
}

export default new VendorAIController();
