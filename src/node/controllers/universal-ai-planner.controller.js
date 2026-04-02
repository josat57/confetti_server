import UniversalAIService from "../services/universal-ai.service.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import { getPlanLevel } from "../middleware/subscription.js";
import crypto from "crypto";

/**
 * Get user context including authentication status, user type, and plan level
 * Also handles guest session management
 */
const getUserContext = async (req) => {
  const context = {
    isAuthenticated: false,
    userType: "guest",
    userId: null,
    planLevel: 1, // Basic level for guests
    planName: "guest",
    subscription: null,
    profile: null,
    guestSessionToken: null,
    isGuestSession: false,
  };

  // Check for guest session token in headers or body
  const guestSessionToken =
    req.headers["x-guest-session"] || req.body.guestSessionToken;

  if (guestSessionToken && !req.user) {
    // Validate guest session
    const guestSession = await UniversalAIService.validateGuestSession(
      guestSessionToken
    );
    if (guestSession) {
      context.guestSessionToken = guestSessionToken;
      context.isGuestSession = true;
      context.userId = `guest_${guestSessionToken.substring(0, 8)}`; // Pseudo user ID for logging
      context.planLevel = guestSession.planLevel || 1;

      logger.debug("Guest session detected", {
        sessionToken: guestSessionToken.substring(0, 10) + "...",
        planLevel: context.planLevel,
        sessionAge: guestSession.createdAt
          ? Date.now() - guestSession.createdAt.getTime()
          : 0,
      });
    }
  }

  // Check if user is authenticated
  if (req.user) {
    context.isAuthenticated = true;
    context.userId = req.user.id;

    // Log user context for debugging
    logger.debug("User context detected", {
      userId: req.user.id,
      userEmail: req.user.email,
      hasVendor: !!req.vendor,
      hasPlanner: !!req.planner,
      userRole: req.user.role,
    });

    // Determine user type and get subscription info
    if (req.vendor) {
      context.userType = "vendor";
      context.planLevel = getPlanLevel(
        req.vendor.subscription?.planName || "basic"
      );
      context.planName = req.vendor.subscription?.planName || "basic";
      context.subscription = req.vendor.subscription;
      context.profile = req.vendor;
    } else if (req.planner) {
      context.userType = "planner";
      context.planLevel = getPlanLevel(
        req.planner.subscription?.planName || "basic"
      );
      context.planName = req.planner.subscription?.planName || "basic";
      context.subscription = req.planner.subscription;
      context.profile = req.planner;
    } else if (req.user.role === "admin" || req.user.role === "super_admin") {
      context.userType = "admin";
      context.planLevel = 5; // Admin gets highest level access
      context.planName = "admin";
      context.profile = req.user;
    } else {
      // Regular authenticated user without specific profile
      context.userType = "user";
      context.planLevel = 2; // Starter level for basic authenticated users
      context.planName = "starter";
      context.profile = req.user;
    }
  }

  return context;
};

/**
 * Generate comprehensive AI event plan for any user type
 * POST /api/v1/ai-planner/generate
 */
export const generateEventPlan = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const userContext = await getUserContext(req);

    // Create or validate guest session for non-authenticated users
    let guestSessionInfo = null;
    if (!userContext.isAuthenticated) {
      guestSessionInfo = await UniversalAIService.createGuestSession(
        userContext.guestSessionToken
      );
      userContext.guestSessionToken = guestSessionInfo.sessionToken;
      userContext.planLevel = guestSessionInfo.session.planLevel;
    }

    logger.info("Universal AI event plan generation started", {
      userType: userContext.userType,
      userId: userContext.userId,
      planLevel: userContext.planLevel,
      isAuthenticated: userContext.isAuthenticated,
      hasGuestSession: !!userContext.guestSessionToken,
      isNewGuestSession: guestSessionInfo?.isNew,
    });

    const eventPlan = await UniversalAIService.generateComprehensivePlan({
      ...req.body,
      userContext,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    const processingTime = Date.now() - startTime;

    // Extract planId and sessionToken for easier frontend access
    const planId = eventPlan.planId;
    const sessionToken = eventPlan.sessionToken;
    const isAutoSaved = eventPlan.autoSaved === true;

    // Determine which ID the frontend should use for subsequent operations
    const resultId =
      userContext.isAuthenticated && isAutoSaved ? planId : sessionToken;

    logger.info("AI plan generation completed", {
      planId,
      sessionToken: sessionToken ? sessionToken.substring(0, 10) + "..." : null,
      resultId: resultId
        ? typeof resultId === "string"
          ? resultId.substring(0, 10) + "..."
          : resultId
        : null,
      userType: userContext.userType,
      isAuthenticated: userContext.isAuthenticated,
      autoSaved: isAutoSaved,
    });

    res.status(200).json({
      status: "success",
      message: "AI event plan generated successfully",
      data: {
        eventPlan,
        // Primary ID for frontend to use for subsequent operations (refine, update, etc.)
        resultId, // Use this for refine/update operations
        // Individual IDs for reference
        planId, // Saved plan ID (only if auto-saved)
        sessionToken, // Session token (for guests or if auto-save failed)
        // Guest session management
        guestSessionToken: userContext.guestSessionToken, // For guest session continuity
        // Status information
        autoSaved: isAutoSaved,
        canRefine: true, // Always true - can refine using either planId or sessionToken
        canSave: userContext.isAuthenticated && !isAutoSaved, // Can manually save if not auto-saved
        canUpgrade: !userContext.isAuthenticated, // Guests can upgrade to save permanently
        userContext: {
          userType: userContext.userType,
          planLevel: userContext.planLevel,
          isAuthenticated: userContext.isAuthenticated,
          isGuestSession: userContext.isGuestSession,
          availableFeatures:
            UniversalAIService.getAvailableFeatures(userContext),
        },
        // Guest session info
        guestSession: guestSessionInfo
          ? {
              isNew: guestSessionInfo.isNew,
              planLevel: guestSessionInfo.session.planLevel,
              totalPlans: guestSessionInfo.session.totalPlansGenerated,
              expiresAt: guestSessionInfo.session.expiresAt,
            }
          : null,
        processingTime,
      },
    });
  } catch (error) {
    logger.error("Universal AI event plan generation failed:", error);
    next(error);
  }
};

/**
 * Analyze client requirements with AI (all users)
 * POST /api/v1/ai-planner/analyze-client
 */
export const analyzeClientRequirements = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    const analysis = await UniversalAIService.analyzeClientRequirements({
      ...req.body,
      userContext,
    });

    res.status(200).json({
      status: "success",
      data: { analysis },
    });
  } catch (error) {
    logger.error("Client requirements analysis failed:", error);
    next(error);
  }
};

/**
 * Generate vendor recommendations (all users)
 * POST /api/v1/ai-planner/recommend-vendors
 */
export const recommendVendors = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    const recommendations =
      await UniversalAIService.generateVendorRecommendationsForUser({
        ...req.body,
        userContext,
      });

    res.status(200).json({
      status: "success",
      data: { recommendations },
    });
  } catch (error) {
    logger.error("Vendor recommendations failed:", error);
    next(error);
  }
};

/**
 * Optimize event budget with AI (all users)
 * POST /api/v1/ai-planner/optimize-budget
 */
export const optimizeBudget = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    const optimization = await UniversalAIService.optimizeEventBudget({
      ...req.body,
      userContext,
    });

    res.status(200).json({
      status: "success",
      data: { optimization },
    });
  } catch (error) {
    logger.error("Budget optimization failed:", error);
    next(error);
  }
};

/**
 * Generate event timeline with AI (all users)
 * POST /api/v1/ai-planner/generate-timeline
 */
export const generateTimeline = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    const timeline = await UniversalAIService.generateTimelineForUser({
      ...req.body,
      userContext,
    });

    res.status(200).json({
      status: "success",
      data: { timeline },
    });
  } catch (error) {
    logger.error("Timeline generation failed:", error);
    next(error);
  }
};

/**
 * Get AI-powered market insights (subscription-based)
 * GET /api/v1/ai-planner/market-insights
 */
export const getMarketInsights = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    // Market insights require at least basic subscription for authenticated users
    if (userContext.isAuthenticated && userContext.planLevel < 2) {
      return next(
        new AppError("Market insights require Starter plan or higher", 403)
      );
    }

    const insights = await UniversalAIService.generateMarketInsightsForUser({
      userContext,
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
};

/**
 * Generate AI-powered proposal (authenticated users only)
 * POST /api/v1/ai-planner/generate-proposal
 */
export const generateProposal = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    if (!userContext.isAuthenticated) {
      return next(
        new AppError("Proposal generation requires authentication", 401)
      );
    }

    const proposal = await UniversalAIService.generateProposalForUser({
      ...req.body,
      userContext,
    });

    res.status(200).json({
      status: "success",
      data: { proposal },
    });
  } catch (error) {
    logger.error("Proposal generation failed:", error);
    next(error);
  }
};

/**
 * Get AI learning insights (authenticated users only)
 * GET /api/v1/ai-planner/learning-insights
 */
export const getLearningInsights = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    if (!userContext.isAuthenticated) {
      return next(
        new AppError("Learning insights require authentication", 401)
      );
    }

    const insights = await UniversalAIService.generateLearningInsightsForUser({
      userContext,
    });

    res.status(200).json({
      status: "success",
      data: { insights },
    });
  } catch (error) {
    logger.error("Learning insights generation failed:", error);
    next(error);
  }
};

/**
 * Train AI model with user-specific data (Professional+ only)
 * POST /api/v1/ai-planner/train-model
 */
export const trainModel = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    if (!userContext.isAuthenticated) {
      return next(new AppError("Model training requires authentication", 401));
    }

    if (userContext.planLevel < 4) {
      return next(
        new AppError(
          "AI model training requires Professional plan or higher",
          403
        )
      );
    }

    const trainingResult = await UniversalAIService.trainUserModel({
      userContext,
      trainingData: req.body,
    });

    res.status(200).json({
      status: "success",
      data: { trainingResult },
    });
  } catch (error) {
    logger.error("AI model training failed:", error);
    next(error);
  }
};

/**
 * Get AI model performance metrics (Professional+ only)
 * GET /api/v1/ai-planner/model-metrics
 */
export const getModelMetrics = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    if (!userContext.isAuthenticated) {
      return next(new AppError("Model metrics require authentication", 401));
    }

    if (userContext.planLevel < 4) {
      return next(
        new AppError("Model metrics require Professional plan or higher", 403)
      );
    }

    const metrics = await UniversalAIService.getModelPerformanceMetrics({
      userContext,
    });

    res.status(200).json({
      status: "success",
      data: { metrics },
    });
  } catch (error) {
    logger.error("Model metrics retrieval failed:", error);
    next(error);
  }
};

/**
 * Generate visual content suggestions (all users)
 * POST /api/v1/ai-planner/visual-suggestions
 */
export const generateVisualSuggestions = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    const suggestions =
      await UniversalAIService.generateVisualIntelligenceForUser({
        ...req.body,
        userContext,
      });

    res.status(200).json({
      status: "success",
      data: { suggestions },
    });
  } catch (error) {
    logger.error("Visual suggestions generation failed:", error);
    next(error);
  }
};

/**
 * Save AI-generated plan (authenticated users only)
 * POST /api/v1/ai-planner/save-plan
 */
export const savePlan = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    if (!userContext.isAuthenticated) {
      return next(new AppError("Saving plans requires authentication", 401));
    }

    const savedPlan = await UniversalAIService.savePlan({
      ...req.body,
      userContext,
    });

    res.status(200).json({
      status: "success",
      message: "Plan saved successfully",
      data: { savedPlan },
    });
  } catch (error) {
    logger.error("Plan saving failed:", error);
    next(error);
  }
};

/**
 * POST /api/v1/ai-planner/save-generated-plan
 * Save a plan that was generated but not auto-saved
 */
export const saveGeneratedPlan = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    if (!userContext.isAuthenticated) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required to save plans",
      });
    }

    const { planData, sessionToken, eventTitle } = req.body;

    logger.info("Saving generated AI plan", {
      userId: userContext.userId,
      userType: userContext.userType,
      hasSessionToken: !!sessionToken,
    });

    // If sessionToken is provided, try to get the plan from session cache first
    let planToSave = planData;
    if (sessionToken && !planData) {
      const sessionPlan = await UniversalAIService.getPlanResult({
        resultId: sessionToken,
        userContext,
      });

      if (sessionPlan) {
        planToSave = sessionPlan.eventPlan;
      }
    }

    if (!planToSave) {
      return res.status(400).json({
        status: "error",
        message: "No plan data provided and session not found",
      });
    }

    // Create a new plan using the auto-save method
    const savedPlan = await UniversalAIService.autoSavePlan({
      userContext,
      originalRequest: planToSave.originalRequest || {
        eventType: planToSave.eventType || "event",
        budget: planToSave.budget,
        guestCount: planToSave.guestCount,
        location: planToSave.location,
        eventDate: planToSave.eventDate,
        theme: planToSave.theme,
        specialRequirements: planToSave.specialRequirements,
        clientProfile: planToSave.clientProfile,
      },
      aiPlan: planToSave,
      sessionInfo: { planId: crypto.randomUUID() },
    });

    if (savedPlan) {
      res.status(200).json({
        status: "success",
        message: "Generated plan saved successfully",
        data: {
          planId: savedPlan.planId,
          title: savedPlan.title,
          savedAt: savedPlan.createdAt,
        },
      });
    } else {
      res.status(500).json({
        status: "error",
        message: "Failed to save the generated plan",
      });
    }
  } catch (error) {
    logger.error("Save generated plan failed:", error);
    next(error);
  }
};

/**
 * Get user's saved plans (authenticated users only)
 * GET /api/v1/ai-planner/my-plans
 * GET /api/v1/ai-planner/plans
 */
export const getMyPlans = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    if (!userContext.isAuthenticated) {
      return next(new AppError("Viewing plans requires authentication", 401));
    }

    const queryOptions = {
      userContext,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      sortBy: req.query.sortBy || "updated",
      sortOrder: req.query.sortOrder || "desc",
      status: req.query.status,
      eventType: req.query.eventType,
    };

    logger.info("Retrieving user plans", {
      userId: userContext.userId,
      userType: userContext.userType,
      ...queryOptions,
    });

    const plans = await UniversalAIService.getUserPlans(queryOptions);

    res.status(200).json({
      status: "success",
      data: {
        plans: plans.plans,
        pagination: plans.pagination,
        filters: {
          sortBy: queryOptions.sortBy,
          sortOrder: queryOptions.sortOrder,
          status: queryOptions.status,
          eventType: queryOptions.eventType,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to retrieve user plans:", error);
    next(error);
  }
};

/**
 * Get AI plan result by ID (supports session tokens and saved plan IDs)
 * GET /api/v1/ai-planner/result/:id
 */
export const getPlanResult = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userContext = await getUserContext(req);

    logger.info("Retrieving AI plan result", {
      resultId: id,
      userType: userContext.userType,
      userId: userContext.userId,
      isAuthenticated: userContext.isAuthenticated,
    });

    const result = await UniversalAIService.getPlanResult({
      resultId: id,
      userContext,
    });

    if (!result) {
      return res.status(404).json({
        status: "error",
        message: "Plan result not found or expired",
        code: "PLAN_NOT_FOUND",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Plan result retrieved successfully",
      data: {
        eventPlan: result.eventPlan,
        userContext: {
          userType: userContext.userType,
          planLevel: userContext.planLevel,
          availableFeatures:
            UniversalAIService.getAvailableFeatures(userContext),
        },
        metadata: {
          retrievedAt: new Date(),
          originalGeneratedAt: result.generatedAt,
          resultType: result.resultType, // 'session' or 'saved'
          canUpgrade: result.canUpgrade,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to retrieve plan result:", error);
    next(error);
  }
};

/**
 * Get user's recent AI plans on login (authenticated users only)
 * GET /api/v1/ai-planner/recent-plans
 */
export const getRecentPlans = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);

    if (!userContext.isAuthenticated) {
      return next(
        new AppError("Authentication required to view recent plans", 401)
      );
    }

    const limit = parseInt(req.query.limit) || 5;
    const includeArchived = req.query.includeArchived === "true";

    logger.info("Retrieving recent AI plans for user", {
      userId: userContext.userId,
      userType: userContext.userType,
      limit,
      includeArchived,
    });

    const recentPlans = await UniversalAIService.getUserRecentPlans(
      userContext,
      {
        limit,
        includeArchived,
      }
    );

    res.status(200).json({
      status: "success",
      message: "Recent plans retrieved successfully",
      data: {
        plans: recentPlans,
        userContext: {
          userType: userContext.userType,
          planLevel: userContext.planLevel,
        },
        metadata: {
          retrievedAt: new Date(),
          totalPlans: recentPlans.length,
          canCreateMore: userContext.planLevel >= 2,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to retrieve recent plans:", error);
    next(error);
  }
};

/**
 * Chat with AI about a specific plan (authenticated users only)
 * POST /api/v1/ai-planner/plans/:planId/chat
 */
export const chatWithPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { message, context } = req.body;
    const userContext = await getUserContext(req);

    if (!userContext.isAuthenticated) {
      return next(new AppError("Authentication required to chat with AI", 401));
    }

    if (!message || message.trim().length === 0) {
      return next(new AppError("Message is required", 400));
    }

    logger.info("Starting AI chat about plan", {
      planId,
      userId: userContext.userId,
      userType: userContext.userType,
      messageLength: message.length,
    });

    const chatResponse = await UniversalAIService.chatWithPlan({
      planId,
      userContext,
      message: message.trim(),
      context,
    });

    res.status(200).json({
      status: "success",
      message: "AI response generated successfully",
      data: {
        response: chatResponse.response,
        suggestions: chatResponse.suggestions || [],
        planUpdates: chatResponse.planUpdates || null,
        conversationId: chatResponse.conversationId,
        userContext: {
          userType: userContext.userType,
          planLevel: userContext.planLevel,
        },
        metadata: {
          timestamp: new Date(),
          aiModel: chatResponse.aiModel || "universal-ai",
          confidence: chatResponse.confidence || 0.85,
          responseTime: chatResponse.responseTime || 0,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to chat with AI about plan:", error);
    next(error);
  }
};

/**
 * Refine existing AI plan with additional prompts (authenticated users only)
 * POST /api/v1/ai-planner/refine/:planId
 */
export const refinePlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { refinementPrompt, refinementType = "general" } = req.body;
    const userContext = await getUserContext(req);

    if (!refinementPrompt) {
      return next(new AppError("Refinement prompt is required", 400));
    }

    logger.info("Refining AI plan", {
      planId,
      userId: userContext.userId,
      userType: userContext.userType,
      refinementType,
      isAuthenticated: userContext.isAuthenticated,
    });

    // Try to refine the plan - this will handle both saved plans and session tokens
    const refinementResult = await UniversalAIService.refinePlanUniversal({
      resultId: planId, // This could be either a saved planId or sessionToken
      userContext,
      refinementPrompt,
      refinementType,
    });

    res.status(200).json({
      status: "success",
      message: "Plan refined successfully",
      data: {
        refinedPlan: refinementResult.refinedPlan,
        changes: refinementResult.changes,
        reasoning: refinementResult.reasoning,
        userContext: {
          userType: userContext.userType,
          planLevel: userContext.planLevel,
        },
        metadata: {
          refinedAt: new Date(),
          refinementType,
          changesCount: refinementResult.changes.length,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to refine plan:", error);
    next(error);
  }
};

/**
 * PUT /api/v1/ai-planner/plans/:planId
 */
export const updatePlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userContext = await getUserContext(req);

    logger.info("Updating AI plan", {
      planId,
      userId: userContext.userId,
      userType: userContext.userType,
    });

    const updatedPlan = await UniversalAIService.updatePlan(planId, {
      ...req.body,
      userContext,
    });

    res.status(200).json({
      status: "success",
      message: "Plan updated successfully",
      data: {
        plan: updatedPlan,
        userContext: {
          userType: userContext.userType,
          planLevel: userContext.planLevel,
        },
      },
    });
  } catch (error) {
    logger.error("Plan update failed:", error);
    next(error);
  }
};

/**
 * DELETE /api/v1/ai-planner/plans/:planId
 */
export const deletePlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userContext = await getUserContext(req);

    logger.info("Deleting AI plan", {
      planId,
      userId: userContext.userId,
      userType: userContext.userType,
    });

    await UniversalAIService.deletePlan(planId, userContext);

    res.status(200).json({
      status: "success",
      message: "Plan deleted successfully",
      data: {
        planId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Plan deletion failed:", error);
    next(error);
  }
};

/**
 * Create guest session for non-authenticated users
 * POST /api/v1/ai-planner/guest-session
 */
export const createGuestSession = async (req, res, next) => {
  try {
    const guestSessionInfo = await UniversalAIService.createGuestSession();

    logger.info("Guest session created via API", {
      sessionToken: guestSessionInfo.sessionToken.substring(0, 10) + "...",
    });

    res.status(200).json({
      status: "success",
      message: "Guest session created successfully",
      data: {
        guestSessionToken: guestSessionInfo.sessionToken,
        session: {
          planLevel: guestSessionInfo.session.planLevel,
          expiresAt: guestSessionInfo.session.expiresAt,
          availableFeatures: UniversalAIService.getAvailableFeatures({
            planLevel: guestSessionInfo.session.planLevel,
            userType: "guest",
            isAuthenticated: false,
          }),
        },
      },
    });
  } catch (error) {
    logger.error("Guest session creation failed:", error);
    next(error);
  }
};

/**
 * Get guest session info and plans
 * GET /api/v1/ai-planner/guest-session/:sessionToken
 */
export const getGuestSession = async (req, res, next) => {
  try {
    const { sessionToken } = req.params;

    const session = await UniversalAIService.validateGuestSession(sessionToken);
    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Guest session not found or expired",
      });
    }

    const sessionPlans = await UniversalAIService.getGuestSessionPlans(
      sessionToken
    );

    res.status(200).json({
      status: "success",
      message: "Guest session retrieved successfully",
      data: {
        session: {
          sessionToken,
          planLevel: session.planLevel,
          totalPlansGenerated: session.totalPlansGenerated,
          totalRefinements: session.totalRefinements,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          availableFeatures: UniversalAIService.getAvailableFeatures({
            planLevel: session.planLevel,
            userType: "guest",
            isAuthenticated: false,
          }),
        },
        plans: sessionPlans,
      },
    });
  } catch (error) {
    logger.error("Get guest session failed:", error);
    next(error);
  }
};

/**
 * Convert guest session to user account (when user registers/logs in)
 * POST /api/v1/ai-planner/convert-guest-session
 */
export const convertGuestSession = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);
    const { guestSessionToken } = req.body;

    if (!userContext.isAuthenticated) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required to convert guest session",
      });
    }

    if (!guestSessionToken) {
      return res.status(400).json({
        status: "error",
        message: "Guest session token is required",
      });
    }

    const conversionResult = await UniversalAIService.convertGuestSessionToUser(
      guestSessionToken,
      userContext
    );

    if (!conversionResult.success) {
      return res.status(400).json({
        status: "error",
        message: conversionResult.message || "Failed to convert guest session",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Guest session converted successfully",
      data: {
        convertedPlans: conversionResult.convertedPlans,
        totalPlansConverted: conversionResult.totalPlansConverted,
        userContext: {
          userType: userContext.userType,
          planLevel: userContext.planLevel,
        },
      },
    });
  } catch (error) {
    logger.error("Guest session conversion failed:", error);
    next(error);
  }
};

/**
 * Get comprehensive AI health check
 * GET /api/v1/ai-planner/health
 */
export const healthCheck = async (req, res, next) => {
  try {
    const health = await UniversalAIService.checkSystemHealth();

    res.status(health.status === "healthy" ? 200 : 503).json({
      status: health.status === "healthy" ? "success" : "error",
      data: health,
    });
  } catch (error) {
    logger.error("Health check failed:", error);
    next(error);
  }
};

// Default export with all functions
export default {
  generateEventPlan,
  analyzeClientRequirements,
  recommendVendors,
  optimizeBudget,
  generateTimeline,
  getMarketInsights,
  generateProposal,
  getLearningInsights,
  trainModel,
  getModelMetrics,
  generateVisualSuggestions,
  savePlan,
  saveGeneratedPlan,
  getMyPlans,
  getPlanResult,
  getRecentPlans,
  chatWithPlan,
  refinePlan,
  updatePlan,
  deletePlan,
  createGuestSession,
  getGuestSession,
  convertGuestSession,
  healthCheck,
};
