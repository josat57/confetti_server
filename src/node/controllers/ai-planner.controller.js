import AIAnalysisService from "../services/ai-analysis.service.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import {
  InsufficientBudgetError,
  LocationNotSupportedError,
  ProcessingTimeoutError,
  ValidationError,
  InvalidSessionError,
} from "../utils/ai-planner-errors.js";
import { escapeRegExp } from "../utils/escape-regex.js";

/**
 * Controller for AI Event Planner endpoints
 */
class AIEventPlannerController {
  /**
   * Analyze event and generate AI-powered plan
   * POST /api/v1/ai-planner/analyze
   */
  async analyzeEvent(req, res, next) {
    try {
      const startTime = Date.now();

      // Extract client info
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get("user-agent");

      logger.info("AI event plan analysis requested", {
        ip: ipAddress,
        eventType: req.body.eventType,
        guestCount: req.body.guestCount,
      });

      // Process the event request
      const result = await AIAnalysisService.processEventRequest(
        req.body,
        ipAddress,
        userAgent
      );

      const processingTime = Date.now() - startTime;

      logger.info("AI event plan analysis completed", {
        sessionToken: result.sessionToken,
        processingTime,
      });

      res.status(200).json({
        status: "success",
        message: "Event plan generated successfully",
        data: {
          sessionToken: result.sessionToken,
          eventPlan: result.eventPlan,
          expiresAt: result.expiresAt,
        },
        meta: {
          processingTime,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get event plan by session token
   * GET /api/v1/ai-planner/result/:sessionToken
   */
  async getEventPlan(req, res, next) {
    try {
      const { sessionToken } = req.params;

      if (!sessionToken || sessionToken.length !== 64) {
        throw new ValidationError(
          "sessionToken",
          "Invalid session token format"
        );
      }

      logger.info("Event plan retrieval requested", { sessionToken });

      const result = await AIAnalysisService.getEventPlanByToken(sessionToken);

      if (!result) {
        throw new InvalidSessionError("Session token not found or has expired");
      }

      res.status(200).json({
        status: "success",
        data: {
          eventPlan: result.eventPlan,
          canUpgrade: result.canUpgrade,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save event plan to user account (requires authentication)
   * POST /api/v1/ai-planner/save
   */
  async saveEventPlan(req, res, next) {
    try {
      const { sessionToken } = req.body;
      const userId = req.user?.id; // From auth middleware

      if (!userId) {
        throw new AppError("Authentication required", 401);
      }

      if (!sessionToken) {
        throw new ValidationError("sessionToken", "Session token is required");
      }

      logger.info("Saving event plan to user account", {
        userId,
        sessionToken,
      });

      // Link the guest session plan to the authenticated user
      const AIEventPlanResult = (await import("../models/ai-event-plan-result.model.js")).default;
      const planResult = await AIEventPlanResult.findOneAndUpdate(
        { sessionToken },
        { $set: { userId } },
        { new: true }
      );

      if (!planResult) {
        throw new AppError("Session not found or already expired", 404);
      }

      // Persist as a named AI plan linked to the user
      const AIPlan = (await import("../models/ai-plan.model.js")).default;
      const { v4: uuidv4 } = await import("uuid");

      const savedPlan = await AIPlan.create({
        userId,
        userType: "user",
        planId: uuidv4(),
        title: planResult.teaserData?.eventSummary?.eventType
          ? `${planResult.teaserData.eventSummary.eventType} Plan`
          : "My Event Plan",
        sessionId: sessionToken,
        teaserData: planResult.teaserData,
        fullData: planResult.fullData || null,
        status: "active",
      });

      res.status(200).json({
        status: "success",
        message: "Event plan saved successfully",
        data: {
          eventId: savedPlan._id,
          planId: savedPlan.planId,
          message: "Your event plan has been saved to your account.",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get full event plan (requires authentication)
   * GET /api/v1/ai-planner/full/:eventId
   */
  async getFullEventPlan(req, res, next) {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("Authentication required", 401);
      }

      logger.info("Full event plan requested", {
        userId,
        eventId,
      });

      // Retrieve the full saved plan with vendor details
      const AIPlan = (await import("../models/ai-plan.model.js")).default;
      const plan = await AIPlan.findOne({ _id: eventId, userId }).lean();

      if (!plan) {
        throw new AppError("Event plan not found", 404);
      }

      // Enrich vendor categories with real vendor profiles if available
      let enrichedVendors = [];
      if (plan.teaserData?.vendorCategories?.length) {
        const Vendor = (await import("../models/vendor.model.js")).default;
        enrichedVendors = await Promise.all(
          plan.teaserData.vendorCategories.map(async (cat) => {
            const vendors = await Vendor.find({
              category: { $regex: escapeRegExp(cat.name), $options: "i" },
              isVerified: true,
              isActive: true,
            })
              .select("businessName category rating reviewCount contact location")
              .limit(3)
              .lean();
            return { ...cat, suggestedVendors: vendors };
          })
        );
      }

      res.status(200).json({
        status: "success",
        data: {
          fullPlan: {
            ...plan,
            teaserData: {
              ...plan.teaserData,
              vendorCategories: enrichedVendors.length
                ? enrichedVendors
                : plan.teaserData?.vendorCategories || [],
            },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check for AI services
   * GET /api/v1/ai-planner/health
   */
  async healthCheck(req, res, next) {
    try {
      const PythonService = (await import("../services/python.service.js"))
        .default;
      const health = await PythonService.checkAIHealth();

      res.status(health.status === "healthy" ? 200 : 503).json({
        status: health.status === "healthy" ? "success" : "error",
        data: health,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AIEventPlannerController();
