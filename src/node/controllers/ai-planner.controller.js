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

      // TODO: Implement save functionality
      // This will be implemented when we add the full plan generation

      res.status(200).json({
        status: "success",
        message: "Event plan saved successfully",
        data: {
          eventId: "placeholder", // Will be actual ID
          message: "Sign up complete! Your event plan has been saved.",
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

      // TODO: Implement full plan retrieval
      // This will include vendor details, contact info, etc.

      res.status(200).json({
        status: "success",
        data: {
          fullPlan: {
            message: "Full plan feature coming soon",
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
