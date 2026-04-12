import PythonService from "./python.service.js";
import VendorService from "./vendor.service.js";
import BudgetService from "./budget.service.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import AILearningModel from "../models/ai-learning.model.js";
import AIPlan from "../models/ai-plan.model.js";
import EventPlanTemplate from "../models/event-plan-template.model.js";
import MarketInsight from "../models/market-insight.model.js";
import Event from "../models/event.model.js";
import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import crypto from "crypto";
import mongoose from "mongoose";

/**
 * Universal AI Service for Event Planning
 * Serves ALL users: vendors, planners, unauthenticated users, and admins
 * Provides intelligent, learning-based event planning capabilities
 */
class UniversalAIService {
  constructor() {
    this.aiModels = {
      gpt4: "gpt-4-turbo-preview",
      claude: "claude-3-sonnet",
      gemini: "gemini-pro",
      local: "local-model",
    };

    this.imageModels = {
      dalle: "dall-e-3",
      midjourney: "midjourney-v6",
      stable: "stable-diffusion-xl",
    };

    // Initialize session cache for guest plans
    this.sessionCache = new Map();

    // Feature access levels by plan
    this.featureAccess = {
      1: {
        // Guest/Basic
        aiModels: ["local"],
        vendorRecommendations: 3,
        visualSuggestions: "basic",
        marketInsights: false,
        learningCapability: false,
        savePlans: false,
        maxPlansPerMonth: 0,
      },
      2: {
        // Starter/Authenticated
        aiModels: ["local", "gpt4"],
        vendorRecommendations: 5,
        visualSuggestions: "standard",
        marketInsights: "limited",
        learningCapability: true,
        savePlans: true,
        maxPlansPerMonth: 5,
      },
      3: {
        // Business
        aiModels: ["gpt4", "claude"],
        vendorRecommendations: 15,
        visualSuggestions: "advanced",
        marketInsights: "comprehensive",
        learningCapability: true,
        savePlans: true,
        maxPlansPerMonth: 20,
        customMoodBoard: true,
        budgetSimulator: true,
      },
      4: {
        // Professional
        aiModels: ["gpt4", "claude", "gemini"],
        vendorRecommendations: 30,
        visualSuggestions: "premium",
        marketInsights: "real-time",
        learningCapability: true,
        savePlans: true,
        maxPlansPerMonth: 50,
        customMoodBoard: true,
        budgetSimulator: true,
        threeDVisualization: true,
        scenarioPlanning: true,
        riskSimulation: true,
        modelTraining: true,
      },
      5: {
        // Enterprise/Admin
        aiModels: ["all"],
        vendorRecommendations: "unlimited",
        visualSuggestions: "enterprise",
        marketInsights: "predictive",
        learningCapability: true,
        savePlans: true,
        maxPlansPerMonth: "unlimited",
        allPremiumFeatures: true,
        customAITraining: true,
        dedicatedSupport: true,
      },
    };
  }

  /**
   * Analyze client requirements using AI
   */
  async analyzeClientRequirements(params) {
    const {
      clientDescription,
      eventRequirements,
      budget,
      additionalContext,
      userContext,
    } = params;

    try {
      const analysisPrompt = `
        Analyze these client requirements for event planning:
        
        Client Description: ${clientDescription}
        Event Requirements: ${eventRequirements}
        Budget: ${
          budget ? `${budget.amount} ${budget.currency}` : "Not specified"
        }
        Additional Context: ${additionalContext || "None"}
        
        Provide comprehensive analysis including:
        1. Client personality and preferences
        2. Key requirements and priorities
        3. Potential challenges
        4. Recommendations for success
        5. Cultural or special considerations
      `;

      // Use available AI models based on user context
      const availableModels = userContext
        ? this.featureAccess[userContext.planLevel].aiModels
        : ["local"];

      let aiResponse;
      if (availableModels.includes("gpt4")) {
        aiResponse = await PythonService.queryAIModel({
          model: "gpt4",
          prompt: analysisPrompt,
          temperature: 0.7,
          maxTokens: 1500,
        });
      } else {
        // Use fallback analysis
        aiResponse = {
          response: {
            personality: "modern and eco-conscious",
            priorities: ["sustainability", "modern design", "guest experience"],
            challenges: ["weather contingency", "sustainable vendor sourcing"],
            recommendations: [
              "Focus on eco-friendly vendors",
              "Plan for outdoor weather backup",
            ],
            cultural_considerations: ["Consider local environmental practices"],
          },
          confidence: 0.7,
          model: "fallback",
        };
      }

      return {
        analysis: {
          clientPersonality: aiResponse.response.personality || "balanced",
          keyPriorities: aiResponse.response.priorities || [],
          potentialChallenges: aiResponse.response.challenges || [],
          recommendations: aiResponse.response.recommendations || [],
          culturalConsiderations:
            aiResponse.response.cultural_considerations || [],
          confidenceScore: aiResponse.confidence || 0.7,
          analysisTimestamp: new Date(),
          planLevel: userContext?.planLevel || 1,
        },
      };
    } catch (error) {
      logger.error("Client requirements analysis failed:", error);
      return {
        analysis: {
          clientPersonality: "modern and eco-conscious",
          keyPriorities: ["guest satisfaction", "memorable experience"],
          potentialChallenges: ["budget management", "vendor coordination"],
          recommendations: ["Start planning early", "Focus on key priorities"],
          culturalConsiderations: ["Consider local customs"],
          confidenceScore: 0.6,
          analysisTimestamp: new Date(),
          planLevel: userContext?.planLevel || 1,
          dataSource: "fallback",
        },
      };
    }
  }

  /**
   * Optimize event budget using AI
   */
  async optimizeEventBudget(params) {
    const { budget, eventType, guestCount, location, priorities, userContext } =
      params;

    try {
      // Use Python service for budget optimization
      const optimization = await PythonService.optimizeBudget(budget, {
        event_type: eventType,
        guest_count: guestCount,
        location: location,
        priorities: priorities,
        plan_level: userContext?.planLevel || 1,
      });

      return {
        optimization: {
          feasibilityScore: optimization.feasibility_score || 75,
          recommendations: optimization.recommendations || [
            "Consider adjusting budget allocation",
            "Focus on high-impact areas",
            "Look for cost-effective alternatives",
          ],
          budgetBreakdown: optimization.budget_breakdown || {
            venue: 40,
            catering: 30,
            entertainment: 15,
            decorations: 10,
            miscellaneous: 5,
          },
          potentialSavings: optimization.potential_savings || [],
          riskFactors: optimization.risk_factors || [],
          planLevel: userContext?.planLevel || 1,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error("Budget optimization failed:", error);
      return {
        optimization: {
          feasibilityScore: 75,
          recommendations: [
            "Consider adjusting budget allocation",
            "Focus on essential items first",
            "Plan for contingencies",
          ],
          budgetBreakdown: {
            venue: 40,
            catering: 30,
            entertainment: 15,
            decorations: 10,
            miscellaneous: 5,
          },
          potentialSavings: [
            "Book early for discounts",
            "Consider off-peak dates",
          ],
          riskFactors: ["Seasonal price variations", "Last-minute changes"],
          planLevel: userContext?.planLevel || 1,
          generatedAt: new Date(),
          dataSource: "fallback",
        },
      };
    }
  }

  /**
   * Generate comprehensive AI-powered event plan for any user type
   */
  async generateComprehensivePlan(params) {
    const {
      eventType,
      eventDate,
      guestCount,
      budget,
      location,
      theme,
      specialRequirements,
      clientProfile,
      userContext,
      ipAddress,
      userAgent,
      // Enhanced parameters
      eventDuration,
      venuePreferences,
      budgetBreakdown,
      guestProfile,
      eventSpecific,
      logistics,
    } = params;

    try {
      logger.info("Starting universal AI event plan generation", {
        userType: userContext.userType,
        userId: userContext.userId,
        eventType,
        planLevel: userContext.planLevel,
      });

      // Check rate limits and usage quotas
      await this.checkUsageLimits(userContext);

      // 1. Enhanced client analysis with comprehensive data
      const clientAnalysis = await this.analyzeClientWithAvailableAI({
        eventType,
        eventDate,
        guestCount,
        budget,
        location,
        theme,
        specialRequirements,
        clientProfile,
        userContext,
        eventDuration,
        venuePreferences,
        guestProfile,
        eventSpecific,
      });

      // 1.5. Generate realistic budget breakdown
      const realisticBudget = await this.generateRealisticBudgetBreakdown({
        eventType,
        guestCount,
        budget,
        location,
        clientAnalysis,
        userContext,
        budgetBreakdown,
      });

      // 2. Generate market insights based on plan level
      const marketInsights = await this.generateMarketInsightsForUser({
        location,
        eventType,
        budget,
        eventDate,
        userContext,
      });

      // 3. Create intelligent vendor recommendations
      const vendorRecommendations =
        await this.generateVendorRecommendationsForUser({
          eventType,
          location,
          budget,
          clientAnalysis,
          userContext,
        });

      // 4. Use realistic budget instead of generic optimization
      const budgetOptimization = realisticBudget;

      // 5. Create visual suggestions based on plan level
      const visualSuggestions = await this.generateVisualIntelligenceForUser({
        theme,
        eventType,
        budget,
        clientAnalysis,
        userContext,
      });

      // 6. Generate comprehensive event components checklist
      const eventComponents = await this.generateComprehensiveEventComponents({
        eventType,
        guestCount,
        budget: realisticBudget,
        clientAnalysis,
        userContext,
        eventSpecific,
        guestProfile,
        clientProfile,
        location,
      });

      // 7. Generate intelligent timeline with realistic deadlines
      const intelligentTimeline = await this.generateRealisticTimeline({
        eventDate,
        eventType,
        eventComponents,
        vendorRecommendations,
        realisticBudget,
        userContext,
      });

      // 7. Generate personalized insights (authenticated users only)
      const personalizedInsights = userContext.isAuthenticated
        ? await this.generatePersonalizedInsightsForUser({
            userContext,
            clientAnalysis,
          })
        : null;

      // 8. Generate risk analysis based on plan level
      const riskAnalysis = await this.generateRiskAssessmentForUser({
        eventType,
        budget,
        timeline: intelligentTimeline,
        marketInsights,
        userContext,
      });

      // 9. Update learning model for authenticated users
      if (userContext.isAuthenticated && userContext.planLevel >= 2) {
        await this.updateLearningModelForUser({
          userContext,
          eventData: params,
          generatedPlan: {
            clientAnalysis,
            budgetOptimization,
            vendorRecommendations,
          },
        });
      }

      // 10. Generate session token for guests or plan ID for authenticated users
      const sessionToken = !userContext.isAuthenticated
        ? this.generateSessionToken()
        : null;
      const sessionInfo = userContext.isAuthenticated
        ? { planId: crypto.randomUUID(), saved: false }
        : {
            sessionToken,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          };

      const comprehensivePlan = {
        ...sessionInfo,
        generatedAt: new Date(),
        userType: userContext.userType,
        planLevel: userContext.planLevel,

        // Original Event Details (ADDED - Task 5)
        eventDetails: {
          eventType,
          eventDate,
          guestCount,
          location: {
            city: location?.city || "Not specified",
            state: location?.state || "Not specified",
            country: location?.country || "Not specified",
            fullLocation: location
              ? `${location.city || ""}, ${location.state || ""}, ${
                  location.country || ""
                }`
                  .replace(/^,\s*|,\s*$/g, "")
                  .replace(/,\s*,/g, ",")
              : "Not specified",
          },
          budget: {
            amount: budget?.amount || 0,
            currency: budget?.currency || "NGN",
            formattedAmount: budget?.amount
              ? `${budget.currency || "NGN"} ${budget.amount.toLocaleString()}`
              : "Not specified",
          },
          eventDuration: eventDuration || "Not specified",
          theme: theme || "Not specified",
          specialRequirements: specialRequirements || "None",
        },

        // Enhanced Core Analysis
        clientAnalysis,
        marketInsights,

        // Realistic Budget & Components
        budgetBreakdown: budgetOptimization, // This is now the realistic budget
        eventComponents, // Comprehensive component checklist
        missedComponents: eventComponents.missed_components,

        // Vendor & Visual Recommendations
        vendorRecommendations,
        visualSuggestions,

        // Realistic Planning Tools
        timeline: intelligentTimeline, // Realistic timeline with deadlines
        personalizedInsights,
        riskAnalysis,

        // Budget Optimization Tips
        budgetOptimizationTips: eventComponents.budget_optimizations,
        culturalConsiderations: eventComponents.cultural_additions,

        // Interactive Features (plan-level dependent)
        interactiveElements:
          this.generateInteractiveElementsForUser(userContext),

        // Learning Insights (authenticated users only)
        aiLearningInsights: userContext.isAuthenticated
          ? await this.generateLearningInsightsForUser({ userContext })
          : null,

        // Future Predictions (higher plans only)
        trendPredictions:
          userContext.planLevel >= 3
            ? await this.generateTrendPredictionsForUser({
                eventType,
                location,
                userContext,
              })
            : null,

        // Upgrade suggestions for lower plans
        upgradeRecommendations:
          this.generateUpgradeRecommendations(userContext),

        // Plan Validation
        planValidation: {
          budgetAllocated: budgetOptimization.validation.totalAllocated,
          budgetRemaining:
            budgetOptimization.totalBudget -
            budgetOptimization.validation.totalAllocated,
          componentsIncluded:
            eventComponents.essential.length +
            eventComponents.recommended.length,
          timelineRealistic: intelligentTimeline.totalWeeksAvailable >= 4,
          culturallyAppropriate: eventComponents.cultural_additions.length > 0,
        },
      };

      // 11. Auto-save plan for authenticated users
      if (userContext.isAuthenticated) {
        try {
          const savedPlan = await this.autoSavePlan({
            userContext,
            originalRequest: params,
            aiPlan: comprehensivePlan,
            sessionInfo: sessionInfo,
          });

          if (savedPlan) {
            // Update the plan with saved information
            comprehensivePlan.planId = savedPlan.planId;
            comprehensivePlan.autoSaved = true;
            comprehensivePlan.savedAt = savedPlan.createdAt;

            logger.info("Plan auto-saved successfully", {
              planId: savedPlan.planId,
              userId: userContext.userId,
            });
          } else {
            logger.warn("Auto-save returned null - plan not saved", {
              userId: userContext.userId,
              userType: userContext.userType,
            });
            comprehensivePlan.autoSaved = false;
          }
        } catch (autoSaveError) {
          logger.error("Auto-save failed with exception:", autoSaveError);
          comprehensivePlan.autoSaved = false;
          comprehensivePlan.autoSaveError = autoSaveError.message;
        }
      }

      // 12. Store session plan for guests (for later retrieval)
      if (sessionToken) {
        await this.storeSessionPlan(
          sessionToken,
          comprehensivePlan,
          userContext.guestSessionToken
        );
      }

      logger.info("Universal AI event plan generated successfully", {
        userType: userContext.userType,
        planId: comprehensivePlan.planId,
        sessionToken: comprehensivePlan.sessionToken
          ? comprehensivePlan.sessionToken.substring(0, 10) + "..."
          : null,
        componentsGenerated: Object.keys(comprehensivePlan).length,
        autoSaved: userContext.isAuthenticated,
      });

      return comprehensivePlan;
    } catch (error) {
      logger.error("Universal plan generation failed:", error);
      throw new AppError("Failed to generate comprehensive event plan", 500);
    }
  }

  /**
   * Analyze client requirements using available AI models based on user plan
   */
  async analyzeClientWithAvailableAI(params) {
    const { userContext } = params;
    const availableModels = this.featureAccess[userContext.planLevel].aiModels;

    try {
      const analysisPrompt = this.buildClientAnalysisPrompt(params);

      // Use the best available AI model
      let aiResponse;
      if (availableModels.includes("gpt4")) {
        aiResponse = await PythonService.queryAIModel({
          model: "gpt4",
          prompt: analysisPrompt,
          temperature: 0.7,
          maxTokens: 2000,
        });
      } else if (availableModels.includes("claude")) {
        aiResponse = await PythonService.queryAIModel({
          model: "claude",
          prompt: analysisPrompt,
          temperature: 0.6,
          maxTokens: 1500,
        });
      } else {
        // Fallback to local model
        aiResponse = await PythonService.queryAIModel({
          model: "local",
          prompt: analysisPrompt,
          temperature: 0.5,
          maxTokens: 1000,
        });
      }

      return {
        clientPersonality: aiResponse.response?.personality || "balanced",
        culturalConsiderations: aiResponse.response?.cultural || [],
        hiddenNeeds: aiResponse.response?.hiddenNeeds || [],
        emotionalJourney: aiResponse.response?.emotionalJourney || {},
        successMetrics: aiResponse.response?.successMetrics || [],
        personalizationOpportunities:
          aiResponse.response?.personalization || [],
        confidenceScore: aiResponse.confidence || 0.7,
        aiModelsUsed: [aiResponse.model],
        analysisTimestamp: new Date(),
        planLevel: userContext.planLevel,
      };
    } catch (error) {
      logger.error("Client analysis failed:", error);
      return this.getFallbackClientAnalysis(params);
    }
  }

  /**
   * Generate market insights based on user plan level
   */
  async generateMarketInsightsForUser(params) {
    const { userContext } = params;
    const planLevel = userContext.planLevel;

    // Market insights not available for basic/guest users
    if (planLevel < 2) {
      return {
        available: false,
        message: "Market insights require Starter plan or higher",
        upgradeRequired: true,
      };
    }

    try {
      const insights = await PythonService.generateMarketInsights({
        location: params.location,
        eventType: params.eventType,
        timeframe: planLevel >= 4 ? "real-time" : "monthly",
        analysisDepth: planLevel >= 3 ? "comprehensive" : "standard",
      });

      return {
        ...insights,
        planLevel,
        available: true,
        dataQuality:
          planLevel >= 4
            ? "real-time"
            : planLevel >= 3
            ? "comprehensive"
            : "standard",
      };
    } catch (error) {
      logger.error("Market insights generation failed:", error);
      return this.getFallbackMarketInsights(params);
    }
  }

  /**
   * Generate vendor recommendations based on user type and plan
   */
  async generateVendorRecommendationsForUser(params) {
    const { userContext } = params;
    const maxRecommendations =
      this.featureAccess[userContext.planLevel].vendorRecommendations;

    try {
      // Get vendors based on event requirements
      const vendors = await VendorService.findVendorsForEvent({
        eventType: params.eventType,
        location: params.location,
        budget: params.budget,
      });

      // Use Python AI service for intelligent matching
      const aiMatching = await PythonService.matchVendors({
        event_type: params.eventType,
        budget: params.budget,
        location: params.location,
        vendors: vendors.slice(0, 50), // Limit for processing
        client_analysis: params.clientAnalysis,
        user_context: userContext,
      });

      // Apply plan-level limitations
      const limitedRecommendations =
        typeof maxRecommendations === "number"
          ? aiMatching.matches?.slice(0, maxRecommendations) || []
          : aiMatching.matches || [];

      return {
        totalVendorsAnalyzed: vendors.length,
        recommendations: limitedRecommendations,
        planLevel: userContext.planLevel,
        maxRecommendations,
        categoryBreakdown: this.categorizeRecommendations(
          limitedRecommendations
        ),
        collaborationSuggestions:
          userContext.planLevel >= 3
            ? await this.generateCollaborationSuggestions(
                limitedRecommendations
              )
            : null,
        alternativeOptions:
          userContext.planLevel >= 4
            ? await this.generateAlternativeOptions(
                vendors,
                limitedRecommendations
              )
            : null,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error("Vendor recommendations failed:", error);

      // Enhanced fallback: try to get vendors directly without AI matching
      try {
        const vendors = await VendorService.findVendorsForEvent({
          eventType: params.eventType,
          location: params.location,
          budget: params.budget,
        });

        // Apply plan-level limitations
        const maxRecommendations =
          this.featureAccess[userContext.planLevel].vendorRecommendations;
        const limitedVendors =
          typeof maxRecommendations === "number"
            ? vendors.slice(0, maxRecommendations)
            : vendors;

        // Convert vendors to recommendation format
        const recommendations = limitedVendors.map((vendor) => ({
          vendor: {
            id: vendor._id,
            name: vendor.name,
            category: vendor.category,
            description: vendor.description,
            averagePrice: vendor.averagePrice,
            priceRange: vendor.priceRange,
            rating: vendor.rating,
            reviewCount: vendor.reviewCount,
            location: vendor.address,
            contact: {
              email: vendor.email,
              phone: vendor.phone,
            },
            features: vendor.features || [],
          },
          matchScore: 0.7, // Default match score
          matchReasons: [
            "Category match",
            "Location match",
            "Event type match",
          ],
          estimatedCost: vendor.averagePrice || 0,
          availability: "Available",
          notes: "Direct vendor match (AI matching unavailable)",
        }));

        return {
          totalVendorsAnalyzed: vendors.length,
          recommendations,
          planLevel: userContext.planLevel,
          maxRecommendations,
          categoryBreakdown: this.categorizeRecommendations(recommendations),
          collaborationSuggestions: null,
          alternativeOptions: null,
          generatedAt: new Date(),
          dataSource: "fallback_direct",
        };
      } catch (fallbackError) {
        logger.error(
          "Fallback vendor recommendations also failed:",
          fallbackError
        );
        return this.getFallbackVendorRecommendations(params);
      }
    }
  }

  /**
   * Generate budget optimization based on user plan
   */
  async generateBudgetOptimizationForUser(params) {
    const { userContext } = params;

    try {
      // Use Python service for budget optimization
      const optimization = await PythonService.optimizeBudget(params.budget, {
        event_type: params.eventType,
        guest_count: params.guestCount,
        location: params.location,
        market_insights: params.marketInsights,
        plan_level: userContext.planLevel,
      });

      // Add plan-specific features
      const enhancedOptimization = {
        ...optimization,
        planLevel: userContext.planLevel,

        // Advanced features based on plan level
        riskAdjustedBudget:
          userContext.planLevel >= 3
            ? await this.calculateRiskAdjustedBudget(
                params.budget,
                params.marketInsights
              )
            : null,

        seasonalAdjustments:
          userContext.planLevel >= 3
            ? await this.calculateSeasonalAdjustments(
                params.budget,
                params.eventType
              )
            : null,

        negotiationOpportunities:
          userContext.planLevel >= 4
            ? await this.identifyNegotiationOpportunities(params.marketInsights)
            : null,

        budgetSimulator:
          userContext.planLevel >= 3
            ? await this.generateBudgetSimulator(params.budget)
            : null,

        whatIfScenarios:
          userContext.planLevel >= 4
            ? await this.generateWhatIfScenarios(params.budget)
            : null,

        optimizationScore: optimization.feasibility_score || 0.8,
        confidenceLevel: 0.85,
        generatedAt: new Date(),
      };

      return enhancedOptimization;
    } catch (error) {
      logger.error("Budget optimization failed:", error);
      return this.getFallbackBudgetOptimization(params);
    }
  }

  /**
   * Generate visual suggestions based on plan level
   */
  async generateVisualIntelligenceForUser(params) {
    const { userContext } = params;
    const visualLevel =
      this.featureAccess[userContext.planLevel].visualSuggestions;

    try {
      const suggestions = {
        planLevel: userContext.planLevel,
        visualLevel,

        // Basic features for all users
        colorPalette: await this.generateColorPalette(params),
        moodBoardConcepts: await this.generateMoodBoardConcepts(params),
        layoutSuggestions: await this.generateLayoutSuggestions(params),

        // Advanced features based on plan
        designTrends:
          visualLevel !== "basic"
            ? await this.analyzeCurrentDesignTrends(params.eventType)
            : null,

        photoSuggestions:
          visualLevel === "advanced" ||
          visualLevel === "premium" ||
          visualLevel === "enterprise"
            ? await this.generatePhotoSuggestions(
                params.theme,
                params.eventType
              )
            : null,

        customMoodBoard:
          userContext.planLevel >= 3
            ? await this.generateCustomMoodBoard(params)
            : null,

        threeDVisualization:
          userContext.planLevel >= 4
            ? await this.generate3DVisualization(params)
            : null,

        virtualWalkthrough:
          userContext.planLevel >= 5
            ? await this.generateVirtualWalkthrough(params)
            : null,

        generatedAt: new Date(),
      };

      return suggestions;
    } catch (error) {
      logger.error("Visual intelligence generation failed:", error);
      return this.getFallbackVisualSuggestions(params);
    }
  }

  /**
   * Generate timeline based on user plan
   */
  async generateTimelineForUser(params) {
    const { userContext } = params;

    try {
      const timeline = {
        planLevel: userContext.planLevel,

        // Basic timeline for all users
        phases: await this.generateBasicTimeline(params),
        criticalPath: await this.identifyCriticalPath(params),

        // Advanced features based on plan
        riskWindows:
          userContext.planLevel >= 2
            ? await this.identifyRiskWindows(params.eventDate, params.eventType)
            : null,

        bookingProbabilities:
          userContext.planLevel >= 3
            ? await this.calculateBookingProbabilities(
                params.vendorRecommendations
              )
            : null,

        dynamicAdjustments:
          userContext.planLevel >= 3
            ? await this.generateDynamicAdjustments(params.eventDate)
            : null,

        scenarioPlanning:
          userContext.planLevel >= 4
            ? await this.generateScenarioPlanning(params.eventDate)
            : null,

        intelligentAlerts:
          userContext.planLevel >= 2
            ? await this.generateIntelligentAlerts(
                params.eventDate,
                params.eventType
              )
            : null,

        timelineScore: 0.85,
        generatedAt: new Date(),
      };

      return timeline;
    } catch (error) {
      logger.error("Timeline generation failed:", error);
      return this.getFallbackTimeline(params);
    }
  }

  /**
   * Generate personalized insights for authenticated users
   */
  async generatePersonalizedInsightsForUser(params) {
    const { userContext } = params;

    if (!userContext.isAuthenticated) {
      return null;
    }

    try {
      // Get user's historical data
      const userHistory = await this.getUserHistory(userContext);
      const learningModel = await AILearningModel.findOne({
        userId: userContext.userId,
        userType: userContext.userType,
      });

      const insights = {
        personalizedRecommendations:
          await this.generatePersonalizedRecommendations({
            userHistory,
            learningModel,
            clientAnalysis: params.clientAnalysis,
            userContext,
          }),

        stylePreferences: await this.analyzeUserStylePreferences(userHistory),
        successPatterns: await this.identifySuccessPatterns(userHistory),
        improvementAreas: await this.identifyImprovementAreas(userHistory),

        // Advanced personalization based on plan level
        aiPersonalityProfile:
          userContext.planLevel >= 3
            ? await this.generateAIPersonalityProfile(userContext)
            : null,

        predictiveInsights:
          userContext.planLevel >= 4
            ? await this.generatePredictiveInsights(userContext)
            : null,

        personalizationScore: learningModel?.accuracy || 0.75,
        generatedAt: new Date(),
        planLevel: userContext.planLevel,
      };

      return insights;
    } catch (error) {
      logger.error("Personalized insights generation failed:", error);
      return this.getFallbackPersonalizedInsights(params);
    }
  }

  /**
   * Generate risk assessment based on plan level
   */
  async generateRiskAssessmentForUser(params) {
    const { userContext } = params;

    try {
      const riskAnalysis = {
        planLevel: userContext.planLevel,
        overallRiskScore: await this.calculateOverallRiskScore(params),

        riskCategories: {
          financial: await this.assessFinancialRisks(
            params.budget,
            params.marketInsights
          ),
          operational: await this.assessOperationalRisks(
            params.timeline,
            params.eventType
          ),
          market:
            userContext.planLevel >= 2
              ? await this.assessMarketRisks(params.marketInsights)
              : null,
          seasonal:
            userContext.planLevel >= 2
              ? await this.assessSeasonalRisks(
                  params.timeline?.eventDate,
                  params.eventType
                )
              : null,
          vendor:
            userContext.planLevel >= 3
              ? await this.assessVendorRisks(params.vendorRecommendations)
              : null,
        },

        mitigationStrategies: await this.generateMitigationStrategies(params),
        contingencyPlans:
          userContext.planLevel >= 3
            ? await this.generateContingencyPlans(params)
            : null,

        // Advanced risk features
        riskSimulation:
          userContext.planLevel >= 4
            ? await this.generateRiskSimulation(params)
            : null,

        predictiveRiskModeling:
          userContext.planLevel >= 5
            ? await this.generatePredictiveRiskModeling(params)
            : null,

        confidenceLevel: 0.82,
        generatedAt: new Date(),
      };

      return riskAnalysis;
    } catch (error) {
      logger.error("Risk assessment generation failed:", error);
      return this.getFallbackRiskAssessment(params);
    }
  }

  /**
   * Update learning model for authenticated users
   */
  async updateLearningModelForUser(params) {
    const { userContext, eventData, generatedPlan } = params;

    if (!userContext.isAuthenticated) {
      return;
    }

    try {
      let learningModel = await AILearningModel.findOne({
        userId: userContext.userId,
        userType: userContext.userType,
      });

      if (!learningModel) {
        learningModel = new AILearningModel({
          userId: userContext.userId,
          userType: userContext.userType,
          learningData: {
            interactions: [],
            preferences: {},
            successPatterns: [],
            accuracy: 0.5,
          },
        });
      }

      // Add new interaction
      learningModel.learningData.interactions.push({
        timestamp: new Date(),
        eventType: eventData.eventType,
        budget: eventData.budget,
        clientProfile: eventData.clientProfile,
        generatedPlan: {
          budgetOptimization:
            generatedPlan.budgetOptimization?.optimizationScore || 0,
          clientAnalysis: generatedPlan.clientAnalysis?.confidenceScore || 0,
          vendorMatching:
            generatedPlan.vendorRecommendations?.recommendations?.length || 0,
        },
        planLevel: userContext.planLevel,
      });

      // Update preferences based on patterns
      await this.updateUserPreferences(learningModel, eventData, userContext);

      // Recalculate accuracy
      learningModel.learningData.accuracy = await this.calculateModelAccuracy(
        learningModel
      );

      await learningModel.save();

      logger.info("Learning model updated", {
        userId: userContext.userId,
        userType: userContext.userType,
        newAccuracy: learningModel.learningData.accuracy,
        totalInteractions: learningModel.learningData.interactions.length,
      });
    } catch (error) {
      logger.error("Learning model update failed:", error);
      // Don't throw error as this is not critical for the main flow
    }
  }

  /**
   * Get available features for user context
   */
  getAvailableFeatures(userContext) {
    return this.featureAccess[userContext.planLevel] || this.featureAccess[1];
  }

  /**
   * Static method to get available features (for controller access)
   */
  static getAvailableFeatures(userContext) {
    const instance = new UniversalAIService();
    return instance.getAvailableFeatures(userContext);
  }

  /**
   * Generate upgrade recommendations for lower plan users
   */
  generateUpgradeRecommendations(userContext) {
    if (userContext.planLevel >= 5) {
      return null; // No upgrades needed for highest plan
    }

    const currentFeatures = this.featureAccess[userContext.planLevel];
    const nextLevelFeatures = this.featureAccess[userContext.planLevel + 1];

    if (!nextLevelFeatures) {
      return null;
    }

    return {
      currentPlan: userContext.planName,
      suggestedPlan: this.getPlanNameByLevel(userContext.planLevel + 1),
      newFeatures: this.getFeatureDifferences(
        currentFeatures,
        nextLevelFeatures
      ),
      benefits: this.generateUpgradeBenefits(userContext.planLevel + 1),
      estimatedValue: this.calculateUpgradeValue(userContext.planLevel + 1),
    };
  }

  /**
   * Check usage limits and quotas
   */
  async checkUsageLimits(userContext) {
    if (!userContext.isAuthenticated) {
      // For guests, implement IP-based rate limiting
      return this.checkGuestRateLimits(userContext);
    }

    const planFeatures = this.featureAccess[userContext.planLevel];
    const maxPlansPerMonth = planFeatures.maxPlansPerMonth;

    if (typeof maxPlansPerMonth === "number") {
      // Check monthly usage
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const monthlyUsage = await this.getMonthlyUsage(
        userContext.userId,
        currentMonth
      );

      if (monthlyUsage >= maxPlansPerMonth) {
        throw new AppError(
          `Monthly plan generation limit reached (${maxPlansPerMonth}). Please upgrade your plan.`,
          429
        );
      }
    }
  }

  /**
   * Save AI-generated plan for authenticated users
   */
  async savePlan(params) {
    const { userContext, planData, eventTitle } = params;

    if (!userContext.isAuthenticated) {
      throw new AppError("Authentication required to save plans", 401);
    }

    try {
      const planTitle = eventTitle || this.generatePlanTitle(planData);
      const planDescription = this.generatePlanDescription(planData);

      const savedPlan = new AIPlan({
        userId: userContext.userId,
        userType: userContext.userType,
        planId: crypto.randomUUID(),
        title: planTitle,
        description: planDescription,

        originalRequest: {
          eventType: planData.eventType,
          budget: planData.budget,
          guestCount: planData.guestCount,
          location: planData.location,
          date: {
            preferred: planData.eventDate,
            flexible: planData.flexibleDate || false,
          },
          requirements: planData.specialRequirements,
          preferences: planData.theme ? { theme: planData.theme } : {},
          clientProfile: planData.clientProfile,
        },

        aiPlan: {
          overview: {
            concept: "Custom Event",
            theme: planData.theme || "Classic",
            style: "Professional",
            atmosphere: "Elegant",
            keyHighlights: [],
          },
          timeline: [],
          budgetBreakdown: {
            totalEstimate: planData.budget?.amount || 0,
            currency: planData.budget?.currency || "NGN",
            categories: [],
            contingency: {
              percentage: 10,
              amount: (planData.budget?.amount || 0) * 0.1,
              reason: "Unexpected expenses and adjustments",
            },
          },
          vendorRecommendations: [],
          visualSuggestions: {},
          logistics: {
            setupTimeline: [],
            equipmentNeeds: [],
            staffingRequirements: [],
            contingencyPlans: [],
          },
          riskAssessment: [],
          successMetrics: [],
        },

        status: "draft",

        metadata: {
          aiModel: "universal-ai",
          aiVersion: "2.0",
          processingTime: 0,
          complexity: this.calculatePlanComplexity(planData),
          confidence: 0.85,
          planLevel: userContext.planLevel,
          featuresUsed: ["manual_save"],
        },

        analytics: {
          viewCount: 1,
          lastAccessed: new Date(),
        },

        autoSave: {
          enabled: true,
          lastAutoSave: new Date(),
        },
      });

      await savedPlan.save();

      logger.info("AI plan saved successfully", {
        userId: userContext.userId,
        userType: userContext.userType,
        planId: savedPlan.planId,
      });

      return {
        planId: savedPlan.planId,
        title: savedPlan.title,
        savedAt: savedPlan.createdAt,
      };
    } catch (error) {
      logger.error("Failed to save AI plan:", error);
      throw new AppError("Failed to save plan", 500);
    }
  }

  /**
   * Get user's saved plans with filtering and sorting
   */
  async getUserPlans(params) {
    const {
      userContext,
      page,
      limit,
      sortBy = "updated",
      sortOrder = "desc",
      status,
      eventType,
    } = params;

    try {
      const skip = (page - 1) * limit;

      // Build query - only filter by userId, not userType, as userType can change
      // between sessions (e.g. user creates a planner/vendor profile after generating plans)
      const query = {
        userId: userContext.userId,
      };

      // Add filters
      if (status) {
        query.status = status;
      }

      if (eventType) {
        query["originalRequest.eventType"] = eventType;
      }

      // Build sort object
      const sortField =
        sortBy === "updated"
          ? "lastModified"
          : sortBy === "created"
          ? "createdAt"
          : sortBy === "title"
          ? "title"
          : sortBy === "status"
          ? "status"
          : "lastModified";

      const sortDirection = sortOrder === "asc" ? 1 : -1;
      const sortObj = { [sortField]: sortDirection };

      // Get plans from AIPlan model
      const plans = await AIPlan.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .select(
          "planId title description status lastModified createdAt originalRequest.eventType analytics"
        )
        .lean();

      const total = await AIPlan.countDocuments(query);

      // Transform plans for frontend compatibility
      const transformedPlans = plans.map((plan) => ({
        id: plan._id,
        planId: plan.planId,
        title: plan.title,
        description: plan.description,
        status: plan.status,
        eventType: plan.originalRequest?.eventType || "unknown",
        lastModified: plan.lastModified,
        createdAt: plan.createdAt,
        viewCount: plan.analytics?.viewCount || 0,
        lastAccessed: plan.analytics?.lastAccessed,
      }));

      return {
        plans: transformedPlans,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        summary: {
          totalPlans: total,
          statusBreakdown: await this.getPlanStatusBreakdown(userContext),
          eventTypeBreakdown: await this.getPlanEventTypeBreakdown(userContext),
        },
      };
    } catch (error) {
      logger.error("Failed to get user plans:", error);
      throw new AppError("Failed to retrieve plans", 500);
    }
  }

  /**
   * Get plan status breakdown for user
   */
  async getPlanStatusBreakdown(userContext) {
    try {
      const breakdown = await AIPlan.aggregate([
        {
          $match: {
            userId: userContext.userId,
            userType: userContext.userType,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {};
      breakdown.forEach((item) => {
        result[item._id] = item.count;
      });

      return result;
    } catch (error) {
      logger.error("Failed to get plan status breakdown:", error);
      return {};
    }
  }

  /**
   * Get plan event type breakdown for user
   */
  async getPlanEventTypeBreakdown(userContext) {
    try {
      const breakdown = await AIPlan.aggregate([
        {
          $match: {
            userId: userContext.userId,
            userType: userContext.userType,
          },
        },
        {
          $group: {
            _id: "$originalRequest.eventType",
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {};
      breakdown.forEach((item) => {
        result[item._id || "unknown"] = item.count;
      });

      return result;
    } catch (error) {
      logger.error("Failed to get plan event type breakdown:", error);
      return {};
    }
  }

  /**
   * Check comprehensive system health
   */
  async checkSystemHealth() {
    try {
      const pythonHealth = await PythonService.checkAIHealth();

      return {
        status: pythonHealth.status,
        universalAI: {
          available: true,
          version: "2.0.0",
          userTypes: ["guest", "user", "vendor", "planner", "admin"],
          planLevels: [1, 2, 3, 4, 5],
        },
        pythonService: pythonHealth.pythonService,
        aiModels: pythonHealth.aiModels,
        capabilities: {
          ...pythonHealth.capabilities,
          universalAccess: true,
          subscriptionBased: true,
          learningEnabled: true,
        },
        performance: pythonHealth.performance,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("System health check failed:", error);
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Helper methods and fallback functions
  generateSessionToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  buildClientAnalysisPrompt(params) {
    const budget = params.budget || {};
    const location = params.location || {};
    const clientProfile = params.clientProfile || {};

    return `
      You are a world-class event planning expert with 15+ years of experience specializing in ${
        params.eventType
      } events. 
      Analyze this event planning request with deep cultural intelligence and market expertise.

      === CLIENT PROFILE ===
      Event Type: ${params.eventType}
      Budget: ${budget.currency || "NGN"} ${(
      budget.amount || 0
    ).toLocaleString()}
      Guest Count: ${params.guestCount || "Not specified"}
      Location: ${location.city || "Not specified"}, ${
      location.country || "Not specified"
    }
      Date: ${params.eventDate || "Not specified"}
      Theme: ${params.theme || "Client's preference to be determined"}
      
      Client Demographics:
      - Age: ${clientProfile.age || "Not specified"}
      - Lifestyle: ${clientProfile.lifestyle || "Not specified"}
      - Cultural Background: ${
        clientProfile.culturalBackground || "Not specified"
      }
      - Experience Level: ${
        clientProfile.experience || "First-time event planner"
      }
      - Personality: ${clientProfile.personality || "Balanced"}
      
      Special Requirements: ${params.specialRequirements || "None specified"}
      
      === ANALYSIS REQUIREMENTS ===
      Provide a comprehensive analysis that includes:
      
      1. **Cultural Intelligence Assessment**:
         - Identify cultural traditions and customs relevant to this event
         - Suggest culturally appropriate elements often overlooked
         - Highlight potential cultural sensitivities
      
      2. **Budget Reality Check**:
         - Assess if budget is realistic for the event scope
         - Identify potential budget gaps or opportunities
         - Suggest budget optimization strategies
      
      3. **Hidden Requirements Discovery**:
         - List essential components typically needed for ${
           params.eventType
         } events
         - Identify elements the client might not have considered
         - Suggest premium upgrades within budget
      
      4. **Guest Experience Mapping**:
         - Consider guest demographics and needs
         - Plan for accessibility and dietary requirements
         - Design memorable moments and experiences
      
      5. **Risk Assessment**:
         - Identify potential challenges specific to this event type and location
         - Suggest mitigation strategies
         - Plan for weather, vendor, and logistical contingencies
      
      6. **Success Metrics Definition**:
         - Define what success looks like for this specific client
         - Identify key performance indicators
         - Suggest feedback collection methods
      
      === OUTPUT FORMAT ===
      Provide detailed, actionable insights in JSON format:
      {
        "clientPersonality": "Detailed personality assessment",
        "culturalConsiderations": ["tradition1", "custom2", "sensitivity3"],
        "budgetAssessment": {
          "realistic": true/false,
          "recommendations": ["suggestion1", "suggestion2"],
          "potentialGaps": ["gap1", "gap2"]
        },
        "hiddenNeeds": ["need1", "need2", "need3"],
        "guestExperienceFactors": ["factor1", "factor2"],
        "riskFactors": [
          {
            "risk": "risk description",
            "probability": "low/medium/high",
            "mitigation": "mitigation strategy"
          }
        ],
        "successMetrics": ["metric1", "metric2", "metric3"],
        "personalizationOpportunities": ["opportunity1", "opportunity2"],
        "essentialComponents": ["component1", "component2", "component3"],
        "culturalElements": ["element1", "element2"],
        "budgetOptimization": ["tip1", "tip2", "tip3"]
      }
      
      Tailor the depth and sophistication to plan level ${
        params.userContext.planLevel
      }.
    `;
  }

  getPlanNameByLevel(level) {
    const names = {
      1: "basic",
      2: "starter",
      3: "business",
      4: "professional",
      5: "enterprise",
    };
    return names[level] || "basic";
  }

  getFeatureDifferences(current, next) {
    const differences = [];

    if (next.aiModels.length > current.aiModels.length) {
      differences.push("Access to advanced AI models");
    }

    if (next.vendorRecommendations > current.vendorRecommendations) {
      differences.push(
        `More vendor recommendations (${next.vendorRecommendations} vs ${current.vendorRecommendations})`
      );
    }

    if (next.marketInsights && !current.marketInsights) {
      differences.push("Market insights and trends");
    }

    if (next.customMoodBoard && !current.customMoodBoard) {
      differences.push("Custom mood boards");
    }

    if (next.modelTraining && !current.modelTraining) {
      differences.push("AI model training");
    }

    return differences;
  }

  generateUpgradeBenefits(level) {
    const benefits = {
      2: ["Save your plans", "Basic market insights", "AI learning"],
      3: ["Advanced AI models", "Custom mood boards", "Budget simulator"],
      4: ["Premium AI models", "3D visualization", "Model training"],
      5: ["All AI models", "Unlimited features", "Dedicated support"],
    };

    return benefits[level] || [];
  }

  calculateUpgradeValue(level) {
    const values = {
      2: "Save time with personalized recommendations",
      3: "Increase success rate by 25% with advanced features",
      4: "Professional-grade tools for complex events",
      5: "Enterprise solutions with unlimited capabilities",
    };

    return values[level] || "Enhanced event planning capabilities";
  }

  // Fallback methods for when AI services fail
  getFallbackClientAnalysis(params) {
    return {
      clientPersonality: "balanced",
      culturalConsiderations: ["Consider local customs"],
      hiddenNeeds: ["Quality service", "Memorable experience"],
      emotionalJourney: {
        planning: "excited",
        event: "joyful",
        post: "satisfied",
      },
      successMetrics: ["Guest satisfaction", "Budget adherence"],
      personalizationOpportunities: ["Custom decorations", "Personalized menu"],
      confidenceScore: 0.6,
      aiModelsUsed: ["fallback"],
      analysisTimestamp: new Date(),
      planLevel: params.userContext.planLevel,
    };
  }

  getFallbackMarketInsights(params) {
    return {
      available: true,
      demandTrends: { trend: "stable", confidence: 0.6 },
      pricingTrends: { trend: "stable", confidence: 0.6 },
      seasonalFactors: { impact: "moderate" },
      generatedAt: new Date(),
      dataSource: "fallback",
      planLevel: params.userContext.planLevel,
    };
  }

  getFallbackVendorRecommendations(params) {
    return {
      totalVendorsAnalyzed: 0,
      recommendations: [],
      planLevel: params.userContext.planLevel,
      maxRecommendations:
        this.featureAccess[params.userContext.planLevel].vendorRecommendations,
      categoryBreakdown: {},
      generatedAt: new Date(),
      dataSource: "fallback",
    };
  }

  getFallbackBudgetOptimization(params) {
    return {
      feasibility_score: 75,
      recommendations: ["Consider adjusting budget allocation"],
      planLevel: params.userContext.planLevel,
      optimizationScore: 0.7,
      confidenceLevel: 0.6,
      generatedAt: new Date(),
      dataSource: "fallback",
    };
  }

  getFallbackVisualSuggestions(params) {
    return {
      planLevel: params.userContext.planLevel,
      visualLevel:
        this.featureAccess[params.userContext.planLevel].visualSuggestions,
      colorPalette: ["#FF6B6B", "#4ECDC4", "#45B7D1"],
      moodBoardConcepts: ["elegant", "modern", "classic"],
      layoutSuggestions: ["Open floor plan", "Intimate seating"],
      generatedAt: new Date(),
      dataSource: "fallback",
    };
  }

  getFallbackTimeline(params) {
    return {
      planLevel: params.userContext.planLevel,
      phases: [
        {
          phase: "Planning",
          duration: "8-12 weeks",
          tasks: ["Book venue", "Select vendors"],
        },
        {
          phase: "Preparation",
          duration: "2-4 weeks",
          tasks: ["Confirm details", "Final headcount"],
        },
        {
          phase: "Event Day",
          duration: "1 day",
          tasks: ["Setup", "Execute", "Cleanup"],
        },
      ],
      criticalPath: [
        "Venue booking",
        "Vendor confirmation",
        "Final preparations",
      ],
      timelineScore: 0.7,
      generatedAt: new Date(),
      dataSource: "fallback",
    };
  }

  getFallbackPersonalizedInsights(params) {
    return {
      personalizedRecommendations: [
        "Focus on client communication",
        "Consider seasonal factors",
        "Plan for contingencies",
      ],
      stylePreferences: { detected: "classic" },
      successPatterns: ["Early planning", "Vendor relationships"],
      improvementAreas: ["Budget management", "Timeline optimization"],
      personalizationScore: 0.6,
      generatedAt: new Date(),
      planLevel: params.userContext.planLevel,
      dataSource: "fallback",
    };
  }

  getFallbackRiskAssessment(params) {
    return {
      planLevel: params.userContext.planLevel,
      overallRiskScore: 0.3,
      riskCategories: {
        financial: { score: 0.2, level: "low" },
        operational: { score: 0.3, level: "low" },
        market: { score: 0.4, level: "medium" },
      },
      mitigationStrategies: [
        "Maintain contingency budget",
        "Have backup vendors",
        "Create detailed timeline",
      ],
      confidenceLevel: 0.6,
      generatedAt: new Date(),
      dataSource: "fallback",
    };
  }

  // Additional helper methods would be implemented here...
  async generateColorPalette(params) {
    // Implementation for color palette generation
    return ["#E8F4F8", "#D4E6F1", "#A9CCE3"];
  }

  async generateMoodBoardConcepts(params) {
    // Implementation for mood board concepts
    return ["elegant", "modern", "rustic"];
  }

  async generateLayoutSuggestions(params) {
    // Implementation for layout suggestions
    return ["Open floor plan", "Intimate seating areas"];
  }

  generateInteractiveElementsForUser(userContext) {
    const features = this.featureAccess[userContext.planLevel];

    return {
      budgetCalculator: true,
      vendorComparison: true,
      timelineBuilder: features.budgetSimulator || false,
      visualPlanner: features.customMoodBoard || false,
      riskAssessment: userContext.planLevel >= 3,
      scenarioPlanning: features.scenarioPlanning || false,
    };
  }

  async getUserHistory(userContext) {
    try {
      const events = await Event.find({
        owner: userContext.userId,
        ownerType: userContext.userType,
      })
        .limit(10)
        .lean();

      return events;
    } catch (error) {
      logger.error("Failed to get user history:", error);
      return [];
    }
  }

  async getMonthlyUsage(userId, month) {
    try {
      const count = await Event.countDocuments({
        owner: userId,
        aiGenerated: true,
        createdAt: {
          $gte: new Date(`${month}-01`),
          $lt: new Date(`${month}-31`),
        },
      });

      return count;
    } catch (error) {
      logger.error("Failed to get monthly usage:", error);
      return 0;
    }
  }

  async checkGuestRateLimits(userContext) {
    // Implement IP-based rate limiting for guests
    // This would typically use Redis or similar
    return true;
  }

  // Placeholder methods for advanced features
  async calculateRiskAdjustedBudget(budget, marketInsights) {
    return null;
  }
  async calculateSeasonalAdjustments(budget, eventType) {
    return null;
  }
  async identifyNegotiationOpportunities(marketInsights) {
    return null;
  }
  async generateBudgetSimulator(budget) {
    return null;
  }
  async generateWhatIfScenarios(budget) {
    return null;
  }
  async analyzeCurrentDesignTrends(eventType) {
    return null;
  }
  async generatePhotoSuggestions(theme, eventType) {
    return null;
  }
  async generateCustomMoodBoard(params) {
    return null;
  }
  async generate3DVisualization(params) {
    return null;
  }
  async generateVirtualWalkthrough(params) {
    return null;
  }
  async generateBasicTimeline(params) {
    return [];
  }
  async identifyCriticalPath(params) {
    return [];
  }
  async identifyRiskWindows(eventDate, eventType) {
    return null;
  }
  async calculateBookingProbabilities(vendorRecommendations) {
    return null;
  }
  async generateDynamicAdjustments(eventDate) {
    return null;
  }
  async generateScenarioPlanning(eventDate) {
    return null;
  }
  async generateIntelligentAlerts(eventDate, eventType) {
    return null;
  }
  async generatePersonalizedRecommendations(params) {
    return [];
  }
  async analyzeUserStylePreferences(userHistory) {
    return {};
  }
  async identifySuccessPatterns(userHistory) {
    return [];
  }
  async identifyImprovementAreas(userHistory) {
    return [];
  }
  async generateAIPersonalityProfile(userContext) {
    return null;
  }
  async generatePredictiveInsights(userContext) {
    return null;
  }
  async calculateOverallRiskScore(params) {
    return 0.3;
  }
  async assessFinancialRisks(budget, marketInsights) {
    return { score: 0.2, level: "low" };
  }
  async assessOperationalRisks(timeline, eventType) {
    return { score: 0.3, level: "low" };
  }
  async assessMarketRisks(marketInsights) {
    return { score: 0.4, level: "medium" };
  }
  async assessSeasonalRisks(eventDate, eventType) {
    return null;
  }
  async assessVendorRisks(vendorRecommendations) {
    return null;
  }
  async generateMitigationStrategies(params) {
    return [];
  }
  async generateContingencyPlans(params) {
    return null;
  }
  async generateRiskSimulation(params) {
    return null;
  }
  async generatePredictiveRiskModeling(params) {
    return null;
  }
  async updateUserPreferences(learningModel, eventData, userContext) {
    return;
  }
  async calculateModelAccuracy(learningModel) {
    return 0.75;
  }
  categorizeRecommendations(recommendations) {
    return {};
  }
  async generateCollaborationSuggestions(recommendations) {
    return null;
  }
  async generateAlternativeOptions(vendors, recommendations) {
    return null;
  }
  async generateTrendPredictionsForUser(params) {
    return null;
  }

  async generateLearningInsightsForUser(params) {
    const { userContext } = params;

    if (!userContext.isAuthenticated) {
      return null;
    }

    try {
      // Get user's learning model
      const learningModel = await AILearningModel.findOne({
        userId: userContext.userId,
        userType: userContext.userType,
      });

      if (!learningModel) {
        return {
          message: "No learning data available yet",
          recommendations: ["Continue using the AI planner to build insights"],
          accuracy: 0.5,
          totalInteractions: 0,
        };
      }

      const insights = {
        accuracy: learningModel.learningData.accuracy || 0.5,
        totalInteractions: learningModel.learningData.interactions?.length || 0,
        preferences: learningModel.learningData.preferences || {},
        successPatterns: learningModel.learningData.successPatterns || [],
        recommendations: [
          "Continue using AI features to improve personalization",
          "Try different event types to expand learning",
          "Provide feedback on AI suggestions",
        ],
        lastUpdated: learningModel.updatedAt,
        planLevel: userContext.planLevel,
      };

      return insights;
    } catch (error) {
      logger.error("Failed to generate learning insights:", error);
      return {
        message: "Unable to generate learning insights",
        accuracy: 0.5,
        totalInteractions: 0,
        recommendations: ["Continue using the AI planner"],
      };
    }
  }

  async generateProposalForUser(params) {
    const { userContext } = params;

    try {
      // Use Python AI service for proposal generation
      const proposalData = await PythonService.queryAIModel({
        model: userContext.planLevel >= 4 ? "gpt4" : "local",
        prompt: this.buildProposalPrompt(params),
        temperature: 0.6,
        maxTokens: 2000,
        context: { userContext, proposalType: "event_planning" },
      });

      return {
        proposal: proposalData.response,
        confidence: proposalData.confidence,
        generatedAt: new Date(),
        planLevel: userContext.planLevel,
        customizations:
          userContext.planLevel >= 3
            ? await this.generateProposalCustomizations(params)
            : null,
      };
    } catch (error) {
      logger.error("Proposal generation failed:", error);
      return this.getFallbackProposal(params);
    }
  }

  buildProposalPrompt(params) {
    const { clientInfo, eventDetails, services, userContext } = params;

    return `
      Generate a professional event planning proposal with the following details:
      
      Client Information: ${JSON.stringify(clientInfo)}
      Event Details: ${JSON.stringify(eventDetails)}
      Services: ${JSON.stringify(services)}
      User Type: ${userContext.userType}
      Plan Level: ${userContext.planLevel}
      
      Create a comprehensive proposal including:
      1. Executive summary
      2. Event overview and objectives
      3. Detailed service breakdown
      4. Timeline and milestones
      5. Investment and payment terms
      6. Next steps
      
      Tailor the proposal to the user's plan level and expertise.
    `;
  }

  async generateProposalCustomizations(params) {
    return {
      brandingOptions: ["Custom logo placement", "Branded materials"],
      presentationStyles: ["Modern", "Classic", "Creative"],
      deliveryFormats: ["PDF", "Interactive presentation", "Video walkthrough"],
    };
  }

  getFallbackProposal(params) {
    return {
      proposal: {
        title: "Event Planning Proposal",
        summary: "Professional event planning services tailored to your needs",
        sections: [
          "Executive Summary",
          "Event Overview",
          "Service Details",
          "Timeline",
          "Investment",
        ],
      },
      confidence: 0.6,
      generatedAt: new Date(),
      planLevel: params.userContext.planLevel,
      dataSource: "fallback",
    };
  }

  /**
   * Create or get guest session
   */
  async createGuestSession(existingToken = null) {
    try {
      if (!this.guestSessions) {
        this.guestSessions = new Map();
      }

      let sessionToken = existingToken;

      // If no existing token provided, create new one
      if (!sessionToken) {
        sessionToken = crypto.randomBytes(32).toString("hex");
      }

      // Check if session already exists
      if (this.guestSessions.has(sessionToken)) {
        const session = this.guestSessions.get(sessionToken);
        // Extend session if it's still valid
        if (new Date() <= session.expiresAt) {
          session.lastAccessed = new Date();
          return { sessionToken, session, isNew: false };
        } else {
          // Session expired, remove it
          this.guestSessions.delete(sessionToken);
        }
      }

      // Create new session
      const sessionData = {
        sessionToken,
        createdAt: new Date(),
        lastAccessed: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        planLevel: 1, // Basic level for guests
        planHistory: [],
        preferences: {},
        totalPlansGenerated: 0,
        totalRefinements: 0,
        ipAddress: null, // Will be set by caller
        userAgent: null, // Will be set by caller
      };

      this.guestSessions.set(sessionToken, sessionData);

      logger.info("Guest session created", {
        sessionToken: sessionToken.substring(0, 10) + "...",
        expiresAt: sessionData.expiresAt,
      });

      return { sessionToken, session: sessionData, isNew: true };
    } catch (error) {
      logger.error("Failed to create guest session:", error);
      throw new AppError("Failed to create guest session", 500);
    }
  }

  /**
   * Validate guest session
   */
  async validateGuestSession(sessionToken) {
    try {
      if (!this.guestSessions || !this.guestSessions.has(sessionToken)) {
        return null;
      }

      const session = this.guestSessions.get(sessionToken);

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        this.guestSessions.delete(sessionToken);
        return null;
      }

      // Update last accessed
      session.lastAccessed = new Date();

      return session;
    } catch (error) {
      logger.error("Failed to validate guest session:", error);
      return null;
    }
  }

  /**
   * Update guest session with plan activity
   */
  async updateGuestSession(sessionToken, activity) {
    try {
      const session = await this.validateGuestSession(sessionToken);
      if (!session) {
        return false;
      }

      // Update session statistics
      if (activity.type === "plan_generated") {
        session.totalPlansGenerated++;
        session.planHistory.push({
          planId: activity.planId,
          sessionToken: activity.sessionToken,
          eventType: activity.eventType,
          createdAt: new Date(),
        });
      } else if (activity.type === "plan_refined") {
        session.totalRefinements++;
      }

      // Update preferences based on activity
      if (activity.preferences) {
        session.preferences = {
          ...session.preferences,
          ...activity.preferences,
        };
      }

      // Upgrade plan level based on usage (gamification)
      if (session.totalPlansGenerated >= 3 && session.planLevel < 2) {
        session.planLevel = 2; // Upgrade to starter level features
        logger.info("Guest session upgraded", {
          sessionToken: sessionToken.substring(0, 10) + "...",
          newPlanLevel: session.planLevel,
          totalPlans: session.totalPlansGenerated,
        });
      }

      return true;
    } catch (error) {
      logger.error("Failed to update guest session:", error);
      return false;
    }
  }

  /**
   * Get guest session plans
   */
  async getGuestSessionPlans(sessionToken) {
    try {
      const session = await this.validateGuestSession(sessionToken);
      if (!session) {
        return [];
      }

      // Get plans from session cache that belong to this session
      const sessionPlans = [];

      if (this.sessionCache) {
        for (const [planToken, planData] of this.sessionCache.entries()) {
          // Check if this plan belongs to the guest session
          if (session.planHistory.some((p) => p.sessionToken === planToken)) {
            sessionPlans.push({
              sessionToken: planToken,
              title: this.generatePlanTitle(
                planData.planData.originalRequest || {}
              ),
              eventType: planData.planData.eventType || "event",
              createdAt: planData.createdAt,
              expiresAt: planData.expiresAt,
            });
          }
        }
      }

      return sessionPlans.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      logger.error("Failed to get guest session plans:", error);
      return [];
    }
  }

  /**
   * Store session plan for guests (enhanced version)
   */
  async storeSessionPlan(sessionToken, planData, guestSessionToken = null) {
    try {
      // Store in memory cache with expiration (24 hours)
      // In production, you might want to use Redis for this
      if (!this.sessionCache) {
        this.sessionCache = new Map();
      }

      const sessionData = {
        planData,
        guestSessionToken, // Link to guest session
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      this.sessionCache.set(sessionToken, sessionData);

      // Update guest session if provided
      if (guestSessionToken) {
        await this.updateGuestSession(guestSessionToken, {
          type: "plan_generated",
          planId: planData.planId,
          sessionToken: sessionToken,
          eventType: planData.eventType,
          preferences: {
            eventType: planData.eventType,
            theme: planData.theme,
          },
        });
      }

      // Clean up expired sessions periodically
      this.cleanupExpiredSessions();

      logger.info("Session plan stored", {
        sessionToken: sessionToken.substring(0, 10) + "...",
        guestSessionToken: guestSessionToken
          ? guestSessionToken.substring(0, 10) + "..."
          : null,
        expiresAt: sessionData.expiresAt,
      });
    } catch (error) {
      logger.error("Failed to store session plan:", error);
      // Don't throw error as this is not critical for the main flow
    }
  }

  /**
   * Get plan result by ID (session token or saved plan ID)
   */
  async getPlanResult(params) {
    const { resultId, userContext } = params;

    try {
      // First, try to get from session cache (for guests)
      if (this.sessionCache && this.sessionCache.has(resultId)) {
        const sessionData = this.sessionCache.get(resultId);

        // Check if session is expired
        if (new Date() > sessionData.expiresAt) {
          this.sessionCache.delete(resultId);
          return null;
        }

        // Enhance plan based on current user context
        const enhancedPlan = await this.enhancePlanForUser(
          sessionData.planData,
          userContext
        );

        return {
          eventPlan: enhancedPlan,
          generatedAt: sessionData.createdAt,
          resultType: "session",
          canUpgrade: userContext.planLevel < 5,
        };
      }

      // If authenticated, try to get from saved plans
      if (userContext.isAuthenticated) {
        const savedEvent = await Event.findOne({
          $or: [
            { _id: resultId },
            { "aiPlanData.planId": resultId },
            { "aiPlanData.sessionToken": resultId },
          ],
          owner: userContext.userId,
          ownerType: userContext.userType,
          aiGenerated: true,
        });

        if (savedEvent) {
          // Enhance saved plan based on current user context
          const enhancedPlan = await this.enhancePlanForUser(
            savedEvent.aiPlanData,
            userContext
          );

          return {
            eventPlan: enhancedPlan,
            generatedAt: savedEvent.createdAt,
            resultType: "saved",
            canUpgrade: userContext.planLevel < 5,
          };
        }
      }

      return null; // Plan not found
    } catch (error) {
      logger.error("Failed to get plan result:", error);
      throw new AppError("Failed to retrieve plan result", 500);
    }
  }

  /**
   * Enhance existing plan based on current user context
   */
  async enhancePlanForUser(originalPlan, currentUserContext) {
    try {
      const originalPlanLevel = originalPlan.planLevel || 1;
      const currentPlanLevel = currentUserContext.planLevel;

      // If user hasn't upgraded, return original plan with updated context
      if (currentPlanLevel <= originalPlanLevel) {
        return {
          ...originalPlan,
          userType: currentUserContext.userType,
          planLevel: currentPlanLevel,
        };
      }

      // User has upgraded - enhance the plan
      const enhancedPlan = { ...originalPlan };

      // Update basic info
      enhancedPlan.userType = currentUserContext.userType;
      enhancedPlan.planLevel = currentPlanLevel;
      enhancedPlan.enhancedAt = new Date();

      // Add upgrade message
      enhancedPlan.upgradeMessage = {
        message: `Congratulations! Your plan has been enhanced with ${this.getPlanNameByLevel(
          currentPlanLevel
        )} features.`,
        newFeatures: this.getFeatureDifferences(
          this.featureAccess[originalPlanLevel],
          this.featureAccess[currentPlanLevel]
        ),
        originalPlanLevel,
        newPlanLevel: currentPlanLevel,
      };

      // Enhance vendor recommendations
      if (currentPlanLevel > originalPlanLevel) {
        const newMaxRecommendations =
          this.featureAccess[currentPlanLevel].vendorRecommendations;
        if (
          typeof newMaxRecommendations === "number" &&
          newMaxRecommendations >
            (enhancedPlan.vendorRecommendations?.maxRecommendations || 0)
        ) {
          // Generate additional vendor recommendations
          enhancedPlan.vendorRecommendations.maxRecommendations =
            newMaxRecommendations;
          enhancedPlan.vendorRecommendations.enhanced = true;
        }
      }

      // Enhance market insights
      if (
        currentPlanLevel >= 2 &&
        (!enhancedPlan.marketInsights || !enhancedPlan.marketInsights.available)
      ) {
        enhancedPlan.marketInsights = {
          available: true,
          enhanced: true,
          insights: {
            demandLevel: "moderate",
            competitionLevel: "medium",
            pricingTrend: "stable",
            seasonalFactors: "spring_peak",
          },
          dataQuality:
            currentPlanLevel >= 4
              ? "real-time"
              : currentPlanLevel >= 3
              ? "comprehensive"
              : "standard",
        };
      }

      // Enhance visual suggestions
      if (currentPlanLevel >= 3) {
        enhancedPlan.visualSuggestions.visualLevel = "advanced";
        enhancedPlan.visualSuggestions.customMoodBoard = {
          available: true,
          enhanced: true,
        };
      }

      // Add premium features for higher plans
      if (currentPlanLevel >= 4) {
        enhancedPlan.premiumFeatures = {
          threeDVisualization: { available: true },
          scenarioPlanning: { available: true },
          riskSimulation: { available: true },
          modelTraining: { available: true },
        };
      }

      logger.info("Plan enhanced for upgraded user", {
        originalPlanLevel,
        newPlanLevel: currentPlanLevel,
        userType: currentUserContext.userType,
        featuresAdded: enhancedPlan.upgradeMessage.newFeatures.length,
      });

      return enhancedPlan;
    } catch (error) {
      logger.error("Failed to enhance plan:", error);
      // Return original plan if enhancement fails
      return originalPlan;
    }
  }

  /**
   * Clean up expired session plans
   */
  cleanupExpiredSessions() {
    if (!this.sessionCache) return;

    const now = new Date();
    for (const [token, data] of this.sessionCache.entries()) {
      if (now > data.expiresAt) {
        this.sessionCache.delete(token);
      }
    }
  }
  /**
   * Auto-save AI plan for authenticated users
   */
  async autoSavePlan({ userContext, originalRequest, aiPlan, sessionInfo }) {
    try {
      const planData = {
        userId: userContext.userId,
        userType: userContext.userType,
        planId: sessionInfo.planId,
        title: this.generatePlanTitle(originalRequest),
        description: this.generatePlanDescription(originalRequest),

        originalRequest: {
          eventType: originalRequest.eventType,
          budget: originalRequest.budget,
          guestCount: originalRequest.guestCount,
          location: originalRequest.location,
          date: {
            preferred: originalRequest.eventDate,
            flexible: originalRequest.flexibleDate || false,
          },
          requirements: originalRequest.specialRequirements,
          preferences: originalRequest.theme
            ? { theme: originalRequest.theme }
            : {},
          clientProfile: originalRequest.clientProfile,
        },

        aiPlan: {
          overview: {
            concept: aiPlan.clientAnalysis?.concept || "Custom Event",
            theme: originalRequest.theme || "Classic",
            style: aiPlan.clientAnalysis?.style || "Professional",
            atmosphere: aiPlan.clientAnalysis?.atmosphere || "Elegant",
            keyHighlights: aiPlan.clientAnalysis?.keyHighlights || [],
          },

          timeline: this.formatTimelineForSave(aiPlan.intelligentTimeline),
          budgetBreakdown: this.formatBudgetForSave(aiPlan.budgetOptimization),
          vendorRecommendations: this.formatVendorsForSave(
            aiPlan.vendorRecommendations
          ),
          visualSuggestions: aiPlan.visualSuggestions || {},
          logistics: this.formatLogisticsForSave(aiPlan.intelligentTimeline),
          riskAssessment: this.formatRiskAssessmentForSave(aiPlan.riskAnalysis),
          successMetrics: this.formatSuccessMetricsForSave(
            aiPlan.clientAnalysis?.successMetrics || []
          ),
        },

        status: "draft",

        metadata: {
          aiModel: "universal-ai",
          aiVersion: "2.0",
          processingTime: Date.now() - aiPlan.generatedAt?.getTime(),
          complexity: this.calculatePlanComplexity(originalRequest),
          confidence: aiPlan.confidence || 0.85,
          planLevel: userContext.planLevel,
          featuresUsed: this.getUsedFeatures(aiPlan, userContext),
        },

        analytics: {
          viewCount: 1,
          lastAccessed: new Date(),
        },

        autoSave: {
          enabled: true,
          lastAutoSave: new Date(),
        },
      };

      const savedPlan = await AIPlan.create(planData);

      logger.info("AI plan auto-saved successfully", {
        planId: savedPlan.planId,
        userId: userContext.userId,
        userType: userContext.userType,
        title: savedPlan.title,
        status: savedPlan.status,
      });

      // Update the aiPlan object with the saved planId
      aiPlan.planId = savedPlan.planId;
      aiPlan.autoSaved = true;
      aiPlan.savedAt = savedPlan.createdAt;

      return savedPlan;
    } catch (error) {
      logger.error("Auto-save failed:", error);
      logger.error("Auto-save error details:", {
        userId: userContext.userId,
        userType: userContext.userType,
        planId: sessionInfo.planId,
        errorMessage: error.message,
        errorStack: error.stack,
      });

      // Don't throw error - auto-save failure shouldn't break plan generation
      // But mark the plan as not auto-saved
      aiPlan.autoSaved = false;
      aiPlan.autoSaveError = error.message;

      return null;
    }
  }

  /**
   * Get user's recent AI plans on login
   */
  async getUserRecentPlans(userContext, options = {}) {
    try {
      const { limit = 5, includeArchived = false } = options;

      // Only filter by userId — userType can change between sessions
      const query = {
        userId: userContext.userId,
      };

      if (!includeArchived) {
        query.status = { $in: ["draft", "active", "refined", "finalized"] };
      }

      const recentPlans = await AIPlan.find(query)
        .sort({ lastModified: -1 })
        .limit(limit)
        .select(
          "planId title description status lastModified analytics originalRequest.eventType"
        );

      return recentPlans;
    } catch (error) {
      logger.error("Failed to get recent plans:", error);
      return [];
    }
  }

  /**
   * Chat with AI about a specific plan
   */
  async chatWithPlan({ planId, userContext, message, context }) {
    try {
      const startTime = Date.now();

      // Get the existing plan — don't filter by userType as it can change between sessions
      const existingPlan = await AIPlan.findOne({
        planId,
        userId: userContext.userId,
      });

      if (!existingPlan) {
        throw new AppError("Plan not found or access denied", 404);
      }

      // Build conversation context
      const conversationContext = {
        planId,
        planTitle: existingPlan.title,
        planDescription: existingPlan.description,
        eventType: existingPlan.originalRequest?.eventType,
        budget: existingPlan.originalRequest?.budget,
        guestCount: existingPlan.originalRequest?.guestCount,
        location: existingPlan.originalRequest?.location,
        currentStatus: existingPlan.status,
        planSummary: this.generatePlanSummary(existingPlan.aiPlan),
        userMessage: message,
        conversationId: context?.conversationId || crypto.randomUUID(),
        previousMessages: context?.previousMessages || [],
      };

      // Generate AI response using available models
      const availableModels =
        this.featureAccess[userContext.planLevel].aiModels;
      const aiResponse = await this.generateChatResponse(
        conversationContext,
        availableModels,
        userContext
      );

      // Update plan analytics
      existingPlan.addInteraction({
        interactionType: "chat",
        details: {
          message: message.substring(0, 100) + "...", // Store truncated message
          responseLength: aiResponse.response?.length || 0,
          aiModel: aiResponse.model,
        },
        userAgent: "AI Chat",
      });

      await existingPlan.save();

      const responseTime = Date.now() - startTime;

      logger.info("AI chat completed successfully", {
        planId,
        userId: userContext.userId,
        messageLength: message.length,
        responseTime,
        aiModel: aiResponse.model,
      });

      return {
        response: aiResponse.response,
        suggestions: aiResponse.suggestions || [],
        planUpdates: aiResponse.planUpdates || null,
        conversationId: conversationContext.conversationId,
        aiModel: aiResponse.model,
        confidence: aiResponse.confidence || 0.85,
        responseTime,
      };
    } catch (error) {
      logger.error("AI chat failed:", error);
      throw error;
    }
  }

  /**
   * Generate AI chat response
   */
  async generateChatResponse(
    conversationContext,
    availableModels,
    userContext
  ) {
    const chatPrompt = this.buildChatPrompt(conversationContext);

    try {
      let aiResponse;
      if (availableModels.includes("gpt4")) {
        aiResponse = await PythonService.queryAIModel({
          model: "gpt4",
          prompt: chatPrompt,
          temperature: 0.7,
          maxTokens: 1500,
          context: conversationContext,
        });
      } else if (availableModels.includes("claude")) {
        aiResponse = await PythonService.queryAIModel({
          model: "claude",
          prompt: chatPrompt,
          temperature: 0.6,
          maxTokens: 1200,
          context: conversationContext,
        });
      } else {
        aiResponse = await PythonService.queryAIModel({
          model: "local",
          prompt: chatPrompt,
          temperature: 0.5,
          maxTokens: 1000,
          context: conversationContext,
        });
      }

      return {
        response:
          aiResponse.response?.message ||
          aiResponse.response ||
          "I understand your question about the plan. Let me help you with that.",
        suggestions: aiResponse.response?.suggestions || [
          "Would you like me to suggest alternatives?",
          "Should we explore budget adjustments?",
          "Do you want to see timeline modifications?",
        ],
        planUpdates: aiResponse.response?.planUpdates || null,
        model: aiResponse.model || "fallback",
        confidence: aiResponse.confidence || 0.7,
      };
    } catch (error) {
      logger.error("AI chat response generation failed:", error);
      return this.getFallbackChatResponse(conversationContext);
    }
  }

  /**
   * Build chat prompt for AI
   */
  buildChatPrompt(context) {
    return `
You are an expert event planning AI assistant. You're having a conversation with a user about their specific event plan.

PLAN CONTEXT:
- Plan ID: ${context.planId}
- Title: ${context.planTitle}
- Event Type: ${context.eventType}
- Budget: ${context.budget?.amount} ${context.budget?.currency}
- Guest Count: ${context.guestCount}
- Location: ${context.location?.city}, ${context.location?.country}
- Current Status: ${context.currentStatus}

PLAN SUMMARY:
${context.planSummary}

CONVERSATION HISTORY:
${context.previousMessages
  .map((msg) => `${msg.role}: ${msg.content}`)
  .join("\n")}

USER MESSAGE: "${context.userMessage}"

Please provide a helpful, conversational response about their event plan. Be specific and reference details from their plan. If they're asking for changes or alternatives, provide concrete suggestions.

Respond in JSON format:
{
  "message": "Your conversational response here",
  "suggestions": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"],
  "planUpdates": null // or specific updates if suggesting changes
}
`;
  }

  /**
   * Generate plan summary for chat context
   */
  generatePlanSummary(aiPlan) {
    const summary = [];

    if (aiPlan.overview) {
      summary.push(`Theme: ${aiPlan.overview.theme || "Not specified"}`);
      summary.push(`Style: ${aiPlan.overview.style || "Not specified"}`);
    }

    if (aiPlan.budgetBreakdown) {
      summary.push(
        `Total Budget: ${
          aiPlan.budgetBreakdown.currency
        } ${aiPlan.budgetBreakdown.totalEstimate?.toLocaleString()}`
      );
    }

    if (aiPlan.timeline?.length) {
      summary.push(`Timeline Phases: ${aiPlan.timeline.length}`);
    }

    if (aiPlan.vendorRecommendations?.length) {
      summary.push(`Vendor Categories: ${aiPlan.vendorRecommendations.length}`);
    }

    return summary.join(" • ") || "Basic event plan structure";
  }

  /**
   * Fallback chat response
   */
  getFallbackChatResponse(context) {
    return {
      response: `I understand you're asking about your ${
        context.eventType
      } plan. While I'm having trouble accessing the full AI capabilities right now, I can see you're planning an event for ${
        context.guestCount
      } guests with a budget of ${
        context.budget?.currency
      } ${context.budget?.amount?.toLocaleString()}. What specific aspect would you like to discuss?`,
      suggestions: [
        "Tell me more about your budget concerns",
        "What vendors are you considering?",
        "Do you need help with the timeline?",
      ],
      planUpdates: null,
      model: "fallback",
      confidence: 0.6,
    };
  }

  /**
   * Universal plan refinement - handles both saved plans and session tokens
   */
  async refinePlanUniversal({
    resultId,
    userContext,
    refinementPrompt,
    refinementType = "general",
  }) {
    try {
      let existingPlan = null;
      let planSource = "unknown";

      // First, try to find as a saved plan (for authenticated users)
      if (userContext.isAuthenticated) {
        existingPlan = await AIPlan.findOne({
          planId: resultId,
          userId: userContext.userId,
        });

        if (existingPlan) {
          planSource = "saved";
        }
      }

      // If not found as saved plan, try session cache (for guests or session tokens)
      if (
        !existingPlan &&
        this.sessionCache &&
        this.sessionCache.has(resultId)
      ) {
        const sessionData = this.sessionCache.get(resultId);

        // Check if session is expired
        if (new Date() <= sessionData.expiresAt) {
          // Create a temporary plan object for refinement
          existingPlan = {
            planId: resultId,
            aiPlan: sessionData.planData,
            originalRequest: sessionData.planData.originalRequest || {},
            // Mock methods for session plans
            addRefinement: () => {},
            save: async () => {
              // Update session cache with refined plan
              sessionData.planData = existingPlan.aiPlan;
              this.sessionCache.set(resultId, sessionData);

              // Update guest session statistics
              if (sessionData.guestSessionToken) {
                await this.updateGuestSession(sessionData.guestSessionToken, {
                  type: "plan_refined",
                  planId: resultId,
                });
              }
            },
          };
          planSource = "session";
        } else {
          this.sessionCache.delete(resultId);
        }
      }

      if (!existingPlan) {
        throw new AppError("Plan not found or expired", 404);
      }

      logger.info("Plan found for refinement", {
        resultId: resultId.substring(0, 10) + "...",
        planSource,
        userType: userContext.userType,
        isAuthenticated: userContext.isAuthenticated,
      });

      // Generate AI refinement based on the prompt
      const refinementResponse = await this.generatePlanRefinement({
        existingPlan: existingPlan.aiPlan,
        originalRequest: existingPlan.originalRequest,
        refinementPrompt,
        refinementType,
        userContext,
      });

      // Apply refinements to the plan
      const updatedPlan = await this.applyRefinementsToPlan(
        existingPlan,
        refinementResponse,
        refinementPrompt,
        refinementType
      );

      // Add refinement to history (only for saved plans)
      if (planSource === "saved" && existingPlan.addRefinement) {
        existingPlan.addRefinement({
          refinementType,
          userPrompt: refinementPrompt,
          aiResponse: refinementResponse,
          changes: updatedPlan.changes,
          reasoning: refinementResponse.reasoning,
        });

        // Update the plan
        existingPlan.aiPlan = updatedPlan.aiPlan;
        existingPlan.status = "refined";
      }

      // Save the updated plan
      await existingPlan.save();

      logger.info("AI plan refined successfully", {
        resultId: resultId.substring(0, 10) + "...",
        planSource,
        refinementType,
        userId: userContext.userId,
        changesCount: updatedPlan.changes.length,
      });

      return {
        success: true,
        refinedPlan: existingPlan,
        changes: updatedPlan.changes,
        reasoning: refinementResponse.reasoning,
        planSource,
        resultId,
      };
    } catch (error) {
      logger.error("Universal plan refinement failed:", error);
      throw error;
    }
  }

  /**
   * Refine existing AI plan with additional prompts (legacy method)
   */
  async refinePlan({
    planId,
    userContext,
    refinementPrompt,
    refinementType = "general",
  }) {
    try {
      const existingPlan = await AIPlan.findOne({
        planId,
        userId: userContext.userId,
      });

      if (!existingPlan) {
        throw new AppError("Plan not found or access denied", 404);
      }

      // Generate AI refinement based on the prompt
      const refinementResponse = await this.generatePlanRefinement({
        existingPlan: existingPlan.aiPlan,
        originalRequest: existingPlan.originalRequest,
        refinementPrompt,
        refinementType,
        userContext,
      });

      // Apply refinements to the plan
      const updatedPlan = await this.applyRefinementsToPlan(
        existingPlan,
        refinementResponse,
        refinementPrompt,
        refinementType
      );

      // Add refinement to history
      existingPlan.addRefinement({
        refinementType,
        userPrompt: refinementPrompt,
        aiResponse: refinementResponse,
        changes: updatedPlan.changes,
        reasoning: refinementResponse.reasoning,
      });

      // Update the plan
      existingPlan.aiPlan = updatedPlan.aiPlan;
      existingPlan.status = "refined";
      await existingPlan.save();

      logger.info("AI plan refined successfully", {
        planId,
        refinementType,
        userId: userContext.userId,
      });

      return {
        success: true,
        refinedPlan: existingPlan,
        changes: updatedPlan.changes,
        reasoning: refinementResponse.reasoning,
      };
    } catch (error) {
      logger.error("Plan refinement failed:", error);
      throw error;
    }
  }

  /**
   * Generate plan refinement using AI
   */
  async generatePlanRefinement({
    existingPlan,
    originalRequest,
    refinementPrompt,
    refinementType,
    userContext,
  }) {
    const availableModels = this.featureAccess[userContext.planLevel].aiModels;

    const refinementContext = {
      existingPlan: JSON.stringify(existingPlan, null, 2),
      originalRequest: JSON.stringify(originalRequest, null, 2),
      refinementPrompt,
      refinementType,
    };

    const prompt = `
You are an expert event planner AI. A user wants to refine their existing event plan.

EXISTING PLAN:
${refinementContext.existingPlan}

ORIGINAL REQUEST:
${refinementContext.originalRequest}

REFINEMENT TYPE: ${refinementType}
USER PROMPT: "${refinementPrompt}"

Please provide specific, actionable refinements to improve the plan based on the user's request. 
Focus on the refinement type and provide detailed reasoning for your suggestions.

Respond with a JSON object containing:
{
  "refinements": {
    "timeline": [...], // Updated timeline items if relevant
    "budget": {...}, // Budget adjustments if relevant  
    "vendors": [...], // Vendor changes if relevant
    "logistics": {...}, // Logistics updates if relevant
    "visual": {...} // Visual/design changes if relevant
  },
  "reasoning": "Detailed explanation of why these changes improve the plan",
  "impact": "Description of how these changes affect the overall event",
  "additionalSuggestions": ["..."] // Optional additional improvements
}`;

    try {
      let aiResponse;
      if (availableModels.includes("gpt4")) {
        aiResponse = await PythonService.queryAIModel({
          model: "gpt4",
          prompt,
          temperature: 0.7,
          maxTokens: 2000,
        });
      } else {
        aiResponse = await PythonService.queryAIModel({
          model: "local",
          prompt,
          temperature: 0.6,
          maxTokens: 1500,
        });
      }

      return (
        aiResponse.response || {
          refinements: {},
          reasoning: "AI refinement completed",
          impact: "Plan has been updated based on your request",
          additionalSuggestions: [],
        }
      );
    } catch (error) {
      logger.error("AI refinement generation failed:", error);
      return {
        refinements: {},
        reasoning: "Unable to generate AI refinements at this time",
        impact: "Please try again later",
        additionalSuggestions: [],
      };
    }
  }

  /**
   * Apply refinements to existing plan
   */
  async applyRefinementsToPlan(
    existingPlan,
    refinementResponse,
    refinementPrompt,
    refinementType
  ) {
    const changes = [];
    const updatedPlan = { ...existingPlan.aiPlan };

    // Apply timeline refinements
    if (refinementResponse.refinements.timeline) {
      updatedPlan.timeline = refinementResponse.refinements.timeline;
      changes.push("Timeline updated");
    }

    // Apply budget refinements
    if (refinementResponse.refinements.budget) {
      updatedPlan.budgetBreakdown = {
        ...updatedPlan.budgetBreakdown,
        ...refinementResponse.refinements.budget,
      };
      changes.push("Budget optimized");
    }

    // Apply vendor refinements
    if (refinementResponse.refinements.vendors) {
      updatedPlan.vendorRecommendations =
        refinementResponse.refinements.vendors;
      changes.push("Vendor recommendations updated");
    }

    // Apply logistics refinements
    if (refinementResponse.refinements.logistics) {
      updatedPlan.logistics = {
        ...updatedPlan.logistics,
        ...refinementResponse.refinements.logistics,
      };
      changes.push("Logistics refined");
    }

    // Apply visual refinements
    if (refinementResponse.refinements.visual) {
      updatedPlan.visualSuggestions = {
        ...updatedPlan.visualSuggestions,
        ...refinementResponse.refinements.visual,
      };
      changes.push("Visual elements updated");
    }

    return {
      aiPlan: updatedPlan,
      changes,
    };
  }

  // Helper methods for formatting data for save
  generatePlanTitle(originalRequest) {
    const eventType = originalRequest.eventType || "Event";
    const date = originalRequest.eventDate
      ? new Date(originalRequest.eventDate).toLocaleDateString()
      : "TBD";
    return `${eventType} Plan - ${date}`;
  }

  generatePlanDescription(originalRequest) {
    const parts = [];
    if (originalRequest.eventType) parts.push(originalRequest.eventType);
    if (originalRequest.guestCount)
      parts.push(`${originalRequest.guestCount} guests`);
    if (originalRequest.budget?.amount)
      parts.push(
        `Budget: ${
          originalRequest.budget.currency || "NGN"
        } ${originalRequest.budget.amount.toLocaleString()}`
      );
    if (originalRequest.location?.city)
      parts.push(`Location: ${originalRequest.location.city}`);

    return parts.join(" • ") || "Custom event plan generated by AI";
  }

  formatTimelineForSave(intelligentTimeline) {
    if (!intelligentTimeline?.phases) return [];

    return intelligentTimeline.phases.map((phase) => ({
      phase: phase.name || phase.phase,
      timeframe: phase.timeframe || phase.duration,
      tasks: (phase.tasks || []).map((task) => ({
        task: task.name || task.task,
        description: task.description || "",
        priority: task.priority || "medium",
        estimatedDuration: task.duration || task.estimatedDuration || "1 hour",
        dependencies: task.dependencies || [],
        assignedTo: task.assignedTo || "Event Coordinator",
        status: "pending",
      })),
    }));
  }

  formatBudgetForSave(budgetOptimization) {
    if (!budgetOptimization) return {};

    return {
      totalEstimate:
        budgetOptimization.optimizedTotal || budgetOptimization.total || 0,
      currency: budgetOptimization.currency || "NGN",
      categories: (budgetOptimization.categories || []).map((cat) => ({
        category: cat.name || cat.category,
        subcategories: (cat.items || []).map((item) => ({
          item: item.name || item.item,
          estimatedCost: item.cost || item.estimatedCost || 0,
          priority: item.priority || "medium",
          notes: item.notes || "",
        })),
        totalCost: cat.total || cat.totalCost || 0,
        percentage: cat.percentage || 0,
      })),
      contingency: {
        percentage: budgetOptimization.contingency?.percentage || 10,
        amount: budgetOptimization.contingency?.amount || 0,
        reason: "Unexpected expenses and adjustments",
      },
    };
  }

  formatVendorsForSave(vendorRecommendations) {
    if (!vendorRecommendations) return [];

    // Handle the actual structure of vendorRecommendations object
    const recommendations =
      vendorRecommendations.recommendations || vendorRecommendations;

    // If it's already an array, use it directly
    if (Array.isArray(recommendations)) {
      return recommendations.map((category) => ({
        category: category.category || category.name,
        vendors: (category.vendors || []).map((vendor) => ({
          vendorId: vendor.id || vendor.vendorId,
          name: vendor.name,
          rating: vendor.rating || 4.0,
          estimatedCost: vendor.cost || vendor.estimatedCost || 0,
          whyRecommended:
            vendor.reason || vendor.whyRecommended || "Highly rated vendor",
          alternativeOptions: vendor.alternatives || [],
        })),
      }));
    }

    // If it's an object with categoryBreakdown, use that
    if (vendorRecommendations.categoryBreakdown) {
      return Object.entries(vendorRecommendations.categoryBreakdown).map(
        ([category, vendors]) => ({
          category,
          vendors: Array.isArray(vendors)
            ? vendors.map((vendor) => ({
                vendorId: vendor.id || vendor.vendorId,
                name: vendor.name,
                rating: vendor.rating || 4.0,
                estimatedCost: vendor.cost || vendor.estimatedCost || 0,
                whyRecommended:
                  vendor.reason ||
                  vendor.whyRecommended ||
                  "Highly rated vendor",
                alternativeOptions: vendor.alternatives || [],
              }))
            : [],
        })
      );
    }

    // Return empty array if no valid structure found
    return [];
  }

  formatLogisticsForSave(intelligentTimeline) {
    return {
      setupTimeline: [],
      equipmentNeeds: [],
      staffingRequirements: [],
      contingencyPlans: [
        {
          scenario: "Weather issues",
          solution: "Indoor backup venue",
          resources: ["Backup venue", "Transportation"],
        },
      ],
    };
  }

  formatRiskAssessmentForSave(riskAnalysis) {
    if (!riskAnalysis?.risks) return [];

    return riskAnalysis.risks.map((risk) => ({
      risk: risk.name || risk.risk,
      probability: risk.probability || "medium",
      impact: risk.impact || "medium",
      mitigation: risk.mitigation || "Monitor and prepare contingency",
      contingency: risk.contingency || "Have backup plan ready",
    }));
  }

  formatSuccessMetricsForSave(successMetrics) {
    if (!Array.isArray(successMetrics)) return [];

    return successMetrics.map((metric) => {
      // If it's already an object with the right structure, use it
      if (typeof metric === "object" && metric.metric) {
        return {
          metric: metric.metric,
          target: metric.target || "To be defined",
          measurement: metric.measurement || "Qualitative assessment",
        };
      }

      // If it's a string, convert it to the expected object format
      if (typeof metric === "string") {
        return {
          metric: metric,
          target: "High satisfaction",
          measurement: "Post-event survey",
        };
      }

      // Fallback for other types
      return {
        metric: String(metric),
        target: "To be defined",
        measurement: "To be determined",
      };
    });
  }

  calculatePlanComplexity(originalRequest) {
    let score = 0;
    if (originalRequest.guestCount > 100) score += 1;
    if (originalRequest.budget?.amount > 500000) score += 1;
    if (originalRequest.specialRequirements?.length > 3) score += 1;

    if (score >= 2) return "complex";
    if (score === 1) return "moderate";
    return "simple";
  }

  getUsedFeatures(aiPlan, userContext) {
    const features = ["basic_planning"];
    if (aiPlan.marketInsights) features.push("market_insights");
    if (aiPlan.visualSuggestions) features.push("visual_suggestions");
    if (aiPlan.personalizedInsights) features.push("personalized_insights");
    if (aiPlan.trendPredictions) features.push("trend_predictions");
    return features;
  }

  /**
   * Update an existing AI plan
   */
  async updatePlan(planId, updateData) {
    try {
      const {
        userContext,
        planData,
        eventTitle,
        status,
        // Direct form fields from client
        eventType,
        budget,
        guestCount,
        date,
        location,
        duration,
        preferences,
        clientInfo,
      } = updateData;

      // Support both custom planId string and MongoDB _id
      const idQuery = mongoose.isValidObjectId(planId)
        ? { $or: [{ planId }, { _id: planId }] }
        : { planId };

      const existingPlan = await AIPlan.findOne({
        ...idQuery,
        userId: userContext.userId,
      });

      if (!existingPlan) {
        throw new AppError("Plan not found or access denied", 404);
      }

      // Update plan data
      if (planData) {
        existingPlan.aiPlan = { ...existingPlan.aiPlan, ...planData };
      }

      if (eventTitle) {
        existingPlan.title = eventTitle;
      }

      if (status) {
        existingPlan.status = status;
      }

      // Update originalRequest fields from direct form payload
      if (eventType) {
        existingPlan.originalRequest = existingPlan.originalRequest || {};
        existingPlan.originalRequest.eventType = eventType;
      }
      if (budget !== undefined) {
        existingPlan.originalRequest = existingPlan.originalRequest || {};
        existingPlan.originalRequest.budget = {
          ...existingPlan.originalRequest.budget,
          amount: budget,
        };
      }
      if (guestCount !== undefined) {
        existingPlan.originalRequest = existingPlan.originalRequest || {};
        existingPlan.originalRequest.guestCount = guestCount;
      }
      if (date) {
        existingPlan.originalRequest = existingPlan.originalRequest || {};
        existingPlan.originalRequest.date = {
          ...existingPlan.originalRequest.date,
          preferred: new Date(date),
        };
      }
      if (location) {
        existingPlan.originalRequest = existingPlan.originalRequest || {};
        existingPlan.originalRequest.location = {
          ...existingPlan.originalRequest.location,
          city: location,
        };
      }
      if (preferences) {
        existingPlan.originalRequest = existingPlan.originalRequest || {};
        existingPlan.originalRequest.preferences = preferences;
      }
      if (clientInfo) {
        existingPlan.originalRequest = existingPlan.originalRequest || {};
        existingPlan.originalRequest.clientProfile = clientInfo;
      }
      if (eventType || budget !== undefined || guestCount !== undefined || date || location || preferences || clientInfo) {
        existingPlan.markModified("originalRequest");
      }

      existingPlan.lastModified = new Date();

      // Add update to interaction history
      existingPlan.addInteraction({
        interactionType: "update",
        details: {
          fieldsUpdated: Object.keys(updateData).filter(
            (key) => key !== "userContext"
          ),
          updatedAt: new Date(),
        },
        userAgent: "Plan Update",
      });

      await existingPlan.save();

      logger.info("AI plan updated successfully", {
        planId,
        userId: userContext.userId,
        userType: userContext.userType,
      });

      // Return a format consistent with getUserPlans so the client can transform it correctly
      return {
        id: existingPlan._id,
        planId: existingPlan.planId,
        title: existingPlan.title,
        description: existingPlan.description || "",
        status: existingPlan.status,
        eventType: existingPlan.originalRequest?.eventType || "",
        lastModified: existingPlan.lastModified,
        createdAt: existingPlan.createdAt,
        viewCount: existingPlan.analytics?.viewCount || 0,
        lastAccessed: existingPlan.analytics?.lastAccessed,
      };
    } catch (error) {
      logger.error("Failed to update AI plan:", error);
      throw error;
    }
  }

  /**
   * Generate realistic budget breakdown based on event type and market data
   */
  async generateRealisticBudgetBreakdown(params) {
    const {
      eventType,
      guestCount,
      budget,
      location,
      clientAnalysis,
      userContext,
    } = params;

    try {
      // Define realistic budget percentages by event type
      const budgetTemplates = {
        wedding: {
          venue: { min: 25, max: 35, priority: 1 },
          catering: { min: 30, max: 40, priority: 1 },
          photography: { min: 10, max: 15, priority: 2 },
          flowers_decor: { min: 8, max: 12, priority: 3 },
          entertainment: { min: 8, max: 12, priority: 2 },
          attire: { min: 5, max: 8, priority: 3 },
          transportation: { min: 2, max: 5, priority: 4 },
          miscellaneous: { min: 5, max: 10, priority: 4 },
        },
        birthday: {
          venue: { min: 20, max: 30, priority: 1 },
          catering: { min: 35, max: 45, priority: 1 },
          entertainment: { min: 15, max: 25, priority: 2 },
          decoration: { min: 10, max: 15, priority: 2 },
          photography: { min: 5, max: 10, priority: 3 },
          party_favors: { min: 3, max: 8, priority: 4 },
          miscellaneous: { min: 5, max: 10, priority: 4 },
        },
        corporate: {
          venue: { min: 20, max: 30, priority: 1 },
          catering: { min: 25, max: 35, priority: 1 },
          av_equipment: { min: 15, max: 25, priority: 1 },
          speakers_entertainment: { min: 10, max: 20, priority: 2 },
          branding_materials: { min: 8, max: 15, priority: 2 },
          staff_coordination: { min: 5, max: 10, priority: 3 },
          miscellaneous: { min: 5, max: 10, priority: 4 },
        },
      };

      const template = budgetTemplates[eventType] || budgetTemplates.birthday;
      const totalBudget = budget?.amount || 0;
      const currency = budget?.currency || "NGN";

      // Calculate realistic allocations
      const breakdown = {};
      let allocatedPercentage = 0;

      // Sort categories by priority
      const sortedCategories = Object.entries(template).sort(
        (a, b) => a[1].priority - b[1].priority
      );

      for (const [category, config] of sortedCategories) {
        const percentage = Math.min(
          config.max,
          Math.max(
            config.min,
            config.min + Math.random() * (config.max - config.min)
          )
        );

        breakdown[category] = {
          percentage: Math.round(percentage),
          amount: Math.round(totalBudget * (percentage / 100)),
          priority: config.priority,
          items: [],
        };

        allocatedPercentage += percentage;
      }

      // Adjust if over 100%
      if (allocatedPercentage > 95) {
        const excess = allocatedPercentage - 90; // Leave 10% for contingency
        const adjustableCategories = Object.entries(breakdown).filter(
          ([_, config]) => config.priority >= 3
        );

        for (const [category, config] of adjustableCategories) {
          const reduction = excess / adjustableCategories.length;
          config.percentage = Math.max(
            config.percentage - reduction,
            template[category].min
          );
          config.amount = Math.round(totalBudget * (config.percentage / 100));
        }
      }

      // Add contingency
      const contingencyPercentage = 10;
      breakdown.contingency = {
        percentage: contingencyPercentage,
        amount: Math.round(totalBudget * (contingencyPercentage / 100)),
        priority: 0,
        purpose: "Unexpected expenses and last-minute changes",
      };

      // Generate specific line items for each category
      await this.generateBudgetLineItems(
        breakdown,
        eventType,
        guestCount,
        location
      );

      return {
        totalBudget,
        currency,
        breakdown,
        validation: {
          totalAllocated: Object.values(breakdown).reduce(
            (sum, cat) => sum + cat.amount,
            0
          ),
          withinBudget: true,
          recommendations: this.generateBudgetRecommendations(
            breakdown,
            eventType,
            userContext
          ),
        },
      };
    } catch (error) {
      logger.error("Failed to generate realistic budget breakdown:", error);
      return this.getFallbackBudgetBreakdown(params);
    }
  }

  /**
   * Generate specific line items for budget categories
   */
  async generateBudgetLineItems(breakdown, eventType, guestCount, location) {
    const itemTemplates = {
      venue: [
        { name: "Venue rental", percentage: 70 },
        { name: "Setup/cleanup fees", percentage: 15 },
        { name: "Security deposit", percentage: 10 },
        { name: "Additional hours", percentage: 5 },
      ],
      catering: [
        { name: "Food per person", percentage: 60, perPerson: true },
        { name: "Beverages", percentage: 25 },
        { name: "Service staff", percentage: 10 },
        { name: "Equipment rental", percentage: 5 },
      ],
      photography: [
        { name: "Photographer (8 hours)", percentage: 70 },
        { name: "Photo editing", percentage: 15 },
        { name: "Print packages", percentage: 10 },
        { name: "Online gallery", percentage: 5 },
      ],
    };

    for (const [category, config] of Object.entries(breakdown)) {
      if (category === "contingency") continue;

      const template = itemTemplates[category] || [
        {
          name: `${category.replace("_", " ")} - Main service`,
          percentage: 80,
        },
        {
          name: `${category.replace("_", " ")} - Additional items`,
          percentage: 20,
        },
      ];

      config.items = template.map((item) => ({
        name: item.name,
        cost: Math.round(config.amount * (item.percentage / 100)),
        quantity: item.perPerson ? guestCount : 1,
        costPerUnit: item.perPerson
          ? Math.round((config.amount * (item.percentage / 100)) / guestCount)
          : null,
        notes: item.perPerson
          ? `Cost per person: ${Math.round(
              (config.amount * (item.percentage / 100)) / guestCount
            )}`
          : "",
      }));
    }
  }

  /**
   * Generate budget optimization recommendations
   */
  generateBudgetRecommendations(breakdown, eventType, userContext) {
    const recommendations = [];

    // Check for potential savings
    const highSpendCategories = Object.entries(breakdown)
      .filter(([_, config]) => config.percentage > 35)
      .map(([category, _]) => category);

    if (highSpendCategories.length > 0) {
      recommendations.push(
        `Consider negotiating better rates for ${highSpendCategories.join(
          " and "
        )} as they represent the largest budget portions.`
      );
    }

    // Suggest optimization based on plan level
    if (userContext.planLevel >= 3) {
      recommendations.push(
        "Consider package deals that combine multiple services for potential savings."
      );
      recommendations.push(
        "Book vendors 6-8 weeks in advance for better rates and availability."
      );
    }

    // Event-specific recommendations
    if (eventType === "wedding") {
      recommendations.push(
        "Consider off-peak dates (weekdays or off-season) for 15-30% savings on venue and vendors."
      );
    } else if (eventType === "corporate") {
      recommendations.push(
        "Leverage corporate partnerships and bulk booking discounts."
      );
    }

    return recommendations;
  }

  /**
   * Generate comprehensive event components checklist
   */
  async generateComprehensiveEventComponents(params) {
    const {
      eventType,
      guestCount,
      budget,
      clientAnalysis,
      userContext,
      eventSpecific,
      guestProfile,
      clientProfile,
      location,
    } = params;

    try {
      // Define comprehensive component templates by event type
      const componentTemplates = {
        wedding: {
          essential: [
            "Venue (ceremony & reception)",
            "Officiant/Minister",
            "Marriage license",
            "Catering (food & beverages)",
            "Photography",
            "Music/Entertainment",
            "Flowers (bridal bouquet, centerpieces)",
            "Wedding cake",
            "Transportation",
            "Accommodation for out-of-town guests",
          ],
          recommended: [
            "Videography",
            "Wedding coordinator",
            "Bridal party attire coordination",
            "Guest favors",
            "Photo booth",
            "Lighting design",
            "Backup weather plan",
            "Guest book/memory station",
            "Welcome bags for guests",
            "Rehearsal dinner",
          ],
          cultural_nigerian: [
            "Traditional wedding ceremony",
            "Aso-ebi (uniform fabric) coordination",
            "Traditional music/drummers",
            "Cultural food items",
            "Traditional wedding cake (plus regular cake)",
            "Kola nut ceremony items",
            "Traditional attire for couple",
            "Cultural dance performances",
            "Traditional blessing ceremonies",
          ],
          luxury_additions: [
            "Destination wedding coordination",
            "Premium floral arrangements",
            "Live band + DJ",
            "Champagne service",
            "Valet parking",
            "Bridal suite preparation",
            "Professional hair & makeup",
            "Wedding website",
            "Live streaming for remote guests",
          ],
        },
        birthday: {
          essential: [
            "Venue rental",
            "Catering (food & drinks)",
            "Birthday cake",
            "Decorations",
            "Entertainment/Activities",
            "Photography",
            "Party favors/Gift bags",
            "Invitations",
            "Tables & seating",
            "Cleanup service",
          ],
          recommended: [
            "Theme-specific decorations",
            "Photo booth with props",
            "Games and activities",
            "Music/DJ services",
            "Special lighting",
            "Balloon arrangements",
            "Party coordinator",
            "Guest book",
            "Thank you cards",
            "Transportation coordination",
          ],
          age_specific: {
            child: [
              "Face painting",
              "Clown/entertainer",
              "Bounce house",
              "Kid-friendly menu",
              "Safety measures",
            ],
            teen: [
              "DJ with teen music",
              "Social media photo ops",
              "Teen-appropriate activities",
              "Trendy decorations",
            ],
            adult: [
              "Cocktail service",
              "Sophisticated entertainment",
              "Adult-oriented activities",
              "Elegant decor",
            ],
            milestone: [
              "Memory displays",
              "Speech/toast coordination",
              "Special recognition",
              "Commemorative items",
            ],
          },
        },
        corporate: {
          essential: [
            "Professional venue",
            "AV equipment & tech support",
            "Catering (meals & refreshments)",
            "Registration/check-in system",
            "Branded materials",
            "Professional photography",
            "Networking areas",
            "Presentation materials",
            "Staff coordination",
            "Transportation/parking",
          ],
          recommended: [
            "Live streaming capabilities",
            "Mobile app for event",
            "Professional speakers",
            "Breakout session rooms",
            "Exhibition/display areas",
            "Welcome reception",
            "Closing ceremony",
            "Feedback collection system",
            "Social media coordination",
            "Post-event follow-up plan",
          ],
          business_objectives: {
            product_launch: [
              "Product displays",
              "Demo stations",
              "Media kit",
              "Press coordination",
            ],
            conference: [
              "Multiple session rooms",
              "Keynote setup",
              "Workshop materials",
              "Networking sessions",
            ],
            team_building: [
              "Activity coordination",
              "Team challenges",
              "Group dining",
              "Awards ceremony",
            ],
          },
        },
      };

      const baseTemplate =
        componentTemplates[eventType] || componentTemplates.birthday;
      let components = {
        essential: [...baseTemplate.essential],
        recommended: [...baseTemplate.recommended],
        missed_components: [],
        cultural_additions: [],
        budget_optimizations: [],
      };

      // Add cultural components for Nigerian events
      // Check multiple sources for Nigerian/African cultural indicators
      const isNigerianEvent =
        clientAnalysis?.culturalConsiderations?.some(
          (c) =>
            c.toLowerCase().includes("nigerian") ||
            c.toLowerCase().includes("african") ||
            c.toLowerCase().includes("nigeria")
        ) ||
        clientProfile?.culturalBackground?.toLowerCase().includes("nigerian") ||
        clientProfile?.culturalBackground?.toLowerCase().includes("african") ||
        location?.country?.toLowerCase().includes("nigeria");

      if (isNigerianEvent && baseTemplate.cultural_nigerian) {
        components.cultural_additions = baseTemplate.cultural_nigerian;
      }

      // Add luxury components for higher budgets
      if (budget.totalBudget > 50000 && baseTemplate.luxury_additions) {
        components.recommended.push(...baseTemplate.luxury_additions);
      }

      // Add age-specific components for birthdays
      if (eventType === "birthday" && eventSpecific?.birthday?.ageGroup) {
        const ageSpecific =
          baseTemplate.age_specific[eventSpecific.birthday.ageGroup];
        if (ageSpecific) {
          components.recommended.push(...ageSpecific);
        }
      }

      // Add business objective-specific components for corporate events
      if (eventType === "corporate" && eventSpecific?.corporate?.eventPurpose) {
        const businessSpecific =
          baseTemplate.business_objectives[
            eventSpecific.corporate.eventPurpose
          ];
        if (businessSpecific) {
          components.essential.push(...businessSpecific);
        }
      }

      // Identify commonly missed components
      components.missed_components = this.identifyMissedComponents(
        eventType,
        guestCount,
        budget,
        guestProfile
      );

      // Generate budget optimization suggestions
      components.budget_optimizations = this.generateComponentBudgetTips(
        eventType,
        budget,
        userContext
      );

      return components;
    } catch (error) {
      logger.error("Failed to generate comprehensive event components:", error);
      return this.getFallbackEventComponents(eventType);
    }
  }

  /**
   * Identify commonly missed components based on event analysis
   */
  identifyMissedComponents(eventType, guestCount, budget, guestProfile) {
    const missedComponents = [];

    // Universal missed components
    if (guestCount > 50) {
      missedComponents.push({
        component: "Guest parking coordination",
        reason: "Large guest count requires parking management",
        importance: "high",
        estimatedCost: Math.min(budget.totalBudget * 0.02, 2000),
      });
    }

    if (guestProfile?.specialNeeds?.dietary?.length > 0) {
      missedComponents.push({
        component: "Special dietary menu options",
        reason: "Guests have specific dietary requirements",
        importance: "high",
        estimatedCost: Math.min(budget.totalBudget * 0.03, 3000),
      });
    }

    if (guestProfile?.specialNeeds?.accessibility?.length > 0) {
      missedComponents.push({
        component: "Accessibility accommodations",
        reason: "Guests require accessibility support",
        importance: "high",
        estimatedCost: Math.min(budget.totalBudget * 0.02, 1500),
      });
    }

    // Event-specific missed components
    if (eventType === "wedding") {
      missedComponents.push(
        {
          component: "Wedding insurance",
          reason: "Protect against vendor cancellations and weather issues",
          importance: "medium",
          estimatedCost: 500,
        },
        {
          component: "Guest transportation",
          reason: "Coordinate transportation between ceremony and reception",
          importance: "medium",
          estimatedCost: Math.min(budget.totalBudget * 0.03, 2500),
        }
      );
    }

    if (eventType === "corporate") {
      missedComponents.push(
        {
          component: "Tech support staff",
          reason: "Ensure smooth AV and presentation operations",
          importance: "high",
          estimatedCost: Math.min(budget.totalBudget * 0.05, 3000),
        },
        {
          component: "Post-event survey system",
          reason: "Collect feedback for future improvements",
          importance: "medium",
          estimatedCost: 500,
        }
      );
    }

    return missedComponents;
  }

  /**
   * Generate component-specific budget optimization tips
   */
  generateComponentBudgetTips(eventType, budget, userContext) {
    const tips = [];

    if (budget.totalBudget < 20000) {
      tips.push("Consider DIY decorations to reduce costs by 30-50%");
      tips.push("Book venues that include tables, chairs, and basic equipment");
      tips.push("Opt for buffet-style catering instead of plated meals");
    }

    if (userContext.planLevel >= 3) {
      tips.push("Bundle services with preferred vendors for package discounts");
      tips.push("Book during off-peak times for 15-25% savings");
      tips.push("Consider alternative venues like community centers or parks");
    }

    if (eventType === "wedding") {
      tips.push("Choose in-season flowers to reduce floral costs by 20-40%");
      tips.push("Consider weekday weddings for significant venue savings");
    }

    return tips;
  }

  /**
   * Generate realistic timeline with proper deadlines
   */
  async generateRealisticTimeline(params) {
    const {
      eventDate,
      eventType,
      eventComponents,
      vendorRecommendations,
      realisticBudget,
      userContext,
    } = params;

    try {
      const eventDateObj = new Date(eventDate);
      const today = new Date();
      const weeksUntilEvent = Math.ceil(
        (eventDateObj - today) / (7 * 24 * 60 * 60 * 1000)
      );

      // Define realistic timeline phases based on event type and time available
      const timelineTemplates = {
        wedding: {
          "12+ weeks": [
            "Book venue",
            "Hire photographer",
            "Choose caterer",
            "Send save-the-dates",
          ],
          "8-12 weeks": [
            "Order flowers",
            "Book entertainment",
            "Finalize guest list",
            "Order wedding cake",
          ],
          "4-8 weeks": [
            "Send invitations",
            "Final venue walkthrough",
            "Confirm all vendors",
            "Plan rehearsal",
          ],
          "2-4 weeks": [
            "Final headcount",
            "Confirm timeline with vendors",
            "Prepare seating chart",
            "Final dress fitting",
          ],
          "1-2 weeks": [
            "Confirm all details",
            "Prepare emergency kit",
            "Brief wedding party",
            "Final payments",
          ],
          "Day of": [
            "Setup supervision",
            "Vendor coordination",
            "Timeline management",
            "Emergency handling",
          ],
        },
        corporate: {
          "8+ weeks": [
            "Book venue",
            "Confirm speakers",
            "Setup registration",
            "Plan catering",
          ],
          "4-8 weeks": [
            "Finalize agenda",
            "Prepare materials",
            "Confirm AV needs",
            "Marketing launch",
          ],
          "2-4 weeks": [
            "Final attendee count",
            "Prepare name badges",
            "Confirm logistics",
            "Tech rehearsal",
          ],
          "1-2 weeks": [
            "Final confirmations",
            "Prepare welcome packets",
            "Brief staff",
            "Setup schedule",
          ],
          "Day of": [
            "Registration management",
            "Tech support",
            "Schedule coordination",
            "Feedback collection",
          ],
        },
        birthday: {
          "4+ weeks": [
            "Book venue",
            "Plan menu",
            "Order decorations",
            "Send invitations",
          ],
          "2-4 weeks": [
            "Confirm guest count",
            "Order cake",
            "Plan activities",
            "Prepare party favors",
          ],
          "1-2 weeks": [
            "Final preparations",
            "Confirm vendors",
            "Prepare playlist",
            "Setup timeline",
          ],
          "Day of": [
            "Setup decorations",
            "Coordinate activities",
            "Manage timeline",
            "Cleanup coordination",
          ],
        },
      };

      const template =
        timelineTemplates[eventType] || timelineTemplates.birthday;
      const timeline = {
        totalWeeksAvailable: weeksUntilEvent,
        phases: [],
        criticalPath: [],
        riskFactors: [],
      };

      // Generate phases based on available time
      for (const [timeframe, tasks] of Object.entries(template)) {
        const phase = {
          phase: timeframe,
          tasks: tasks.map((task) => ({
            task,
            deadline: this.calculateDeadline(eventDateObj, timeframe),
            priority: this.getTaskPriority(task, eventType),
            estimatedCost: this.estimateTaskCost(task, realisticBudget),
            vendor: this.suggestVendorForTask(task, vendorRecommendations),
            status: "pending",
          })),
          completed: false,
        };
        timeline.phases.push(phase);
      }

      // Identify critical path
      timeline.criticalPath = this.identifyCriticalPath(
        timeline.phases,
        eventType
      );

      // Add risk factors
      timeline.riskFactors = this.identifyTimelineRisks(
        weeksUntilEvent,
        eventType,
        eventDateObj
      );

      return timeline;
    } catch (error) {
      logger.error("Failed to generate realistic timeline:", error);
      return this.getFallbackTimeline({ eventType, eventDate });
    }
  }

  /**
   * Calculate specific deadline dates
   */
  calculateDeadline(eventDate, timeframe) {
    const eventDateObj = new Date(eventDate);

    if (timeframe.includes("12+")) {
      return new Date(eventDateObj.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe.includes("8-12")) {
      return new Date(eventDateObj.getTime() - 10 * 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe.includes("4-8")) {
      return new Date(eventDateObj.getTime() - 6 * 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe.includes("2-4")) {
      return new Date(eventDateObj.getTime() - 3 * 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe.includes("1-2")) {
      return new Date(eventDateObj.getTime() - 1.5 * 7 * 24 * 60 * 60 * 1000);
    } else {
      return eventDateObj;
    }
  }

  /**
   * Determine task priority
   */
  getTaskPriority(task, eventType) {
    const highPriorityTasks = [
      "book venue",
      "hire photographer",
      "choose caterer",
      "confirm speakers",
    ];
    const mediumPriorityTasks = [
      "order flowers",
      "book entertainment",
      "send invitations",
    ];

    const taskLower = task.toLowerCase();

    if (highPriorityTasks.some((priority) => taskLower.includes(priority))) {
      return "high";
    } else if (
      mediumPriorityTasks.some((priority) => taskLower.includes(priority))
    ) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Estimate cost for specific tasks
   */
  estimateTaskCost(task, budget) {
    const taskLower = task.toLowerCase();

    if (taskLower.includes("venue")) {
      return budget.breakdown.venue?.amount || 0;
    } else if (taskLower.includes("cater") || taskLower.includes("food")) {
      return budget.breakdown.catering?.amount || 0;
    } else if (taskLower.includes("photo")) {
      return budget.breakdown.photography?.amount || 0;
    } else if (taskLower.includes("flower") || taskLower.includes("decor")) {
      return (
        budget.breakdown.flowers_decor?.amount ||
        budget.breakdown.decoration?.amount ||
        0
      );
    } else {
      return 0;
    }
  }

  /**
   * Suggest vendor for specific tasks
   */
  suggestVendorForTask(task, vendorRecommendations) {
    const taskLower = task.toLowerCase();

    if (taskLower.includes("venue")) return "Venue Coordinator";
    if (taskLower.includes("photo")) return "Photographer";
    if (taskLower.includes("cater") || taskLower.includes("food"))
      return "Caterer";
    if (taskLower.includes("flower")) return "Florist";
    if (taskLower.includes("music") || taskLower.includes("entertainment"))
      return "Entertainment Vendor";

    return "Event Coordinator";
  }

  /**
   * Identify critical path tasks
   */
  identifyCriticalPath(phases, eventType) {
    const criticalTasks = [];

    for (const phase of phases) {
      const highPriorityTasks = phase.tasks.filter(
        (task) => task.priority === "high"
      );
      criticalTasks.push(
        ...highPriorityTasks.map((task) => ({
          task: task.task,
          deadline: task.deadline,
          phase: phase.phase,
        }))
      );
    }

    return criticalTasks.sort(
      (a, b) => new Date(a.deadline) - new Date(b.deadline)
    );
  }

  /**
   * Identify timeline risk factors
   */
  identifyTimelineRisks(weeksUntilEvent, eventType, eventDate) {
    const risks = [];

    if (weeksUntilEvent < 8) {
      risks.push({
        risk: "Limited vendor availability",
        probability: "high",
        impact: "high",
        mitigation:
          "Contact multiple vendors immediately, consider premium rates",
      });
    }

    if (weeksUntilEvent < 4) {
      risks.push({
        risk: "Venue booking challenges",
        probability: "high",
        impact: "critical",
        mitigation: "Expand venue search radius, consider alternative dates",
      });
    }

    // Seasonal risks
    const eventMonth = eventDate.getMonth();
    if ([5, 6, 11].includes(eventMonth)) {
      // June, July, December
      risks.push({
        risk: "Peak season pricing and availability",
        probability: "medium",
        impact: "medium",
        mitigation: "Book immediately, budget for premium rates",
      });
    }

    return risks;
  }

  /**
   * Fallback event components if generation fails
   */
  getFallbackEventComponents(eventType) {
    return {
      essential: ["Venue", "Catering", "Entertainment", "Photography"],
      recommended: ["Decorations", "Coordination", "Transportation"],
      missed_components: [],
      cultural_additions: [],
      budget_optimizations: [
        "Consider package deals",
        "Book in advance for better rates",
      ],
    };
  }

  /**
   * Fallback budget breakdown if AI generation fails
   */
  getFallbackBudgetBreakdown(params) {
    const { budget, eventType } = params;
    const totalBudget = budget?.amount || 0;

    return {
      totalBudget,
      currency: budget?.currency || "NGN",
      breakdown: {
        venue: { percentage: 30, amount: totalBudget * 0.3, items: [] },
        catering: { percentage: 35, amount: totalBudget * 0.35, items: [] },
        entertainment: {
          percentage: 15,
          amount: totalBudget * 0.15,
          items: [],
        },
        decoration: { percentage: 10, amount: totalBudget * 0.1, items: [] },
        contingency: { percentage: 10, amount: totalBudget * 0.1, items: [] },
      },
      validation: {
        totalAllocated: totalBudget,
        withinBudget: true,
        recommendations: [
          "This is a basic budget breakdown. Provide more details for a customized plan.",
        ],
      },
    };
  }

  /**
   * Delete an existing AI plan
   */
  async deletePlan(planId, userContext) {
    try {
      // Support both custom planId string and MongoDB _id
      const idQuery = mongoose.isValidObjectId(planId)
        ? { $or: [{ planId }, { _id: planId }] }
        : { planId };

      const existingPlan = await AIPlan.findOne({
        ...idQuery,
        userId: userContext.userId,
      });

      if (!existingPlan) {
        throw new AppError("Plan not found or access denied", 404);
      }

      await AIPlan.deleteOne({ _id: existingPlan._id });

      logger.info("AI plan deleted successfully", {
        planId,
        userId: userContext.userId,
        userType: userContext.userType,
      });

      return { success: true, planId };
    } catch (error) {
      logger.error("Failed to delete AI plan:", error);
      throw error;
    }
  }

  /**
   * Convert guest session plans to user account
   */
  async convertGuestSessionToUser(guestSessionToken, userContext) {
    try {
      const guestSession = await this.validateGuestSession(guestSessionToken);
      if (!guestSession) {
        return {
          success: false,
          message: "Guest session not found or expired",
        };
      }

      const convertedPlans = [];
      let totalPlansConverted = 0;

      // Convert all plans from guest session to saved plans
      for (const planHistory of guestSession.planHistory) {
        try {
          // Get plan data from session cache
          if (
            this.sessionCache &&
            this.sessionCache.has(planHistory.sessionToken)
          ) {
            const sessionData = this.sessionCache.get(planHistory.sessionToken);

            // Create saved plan from session data
            const savedPlan = await this.autoSavePlan({
              userContext,
              originalRequest: sessionData.planData.originalRequest || {
                eventType: sessionData.planData.eventType || "event",
                budget: sessionData.planData.budget,
                guestCount: sessionData.planData.guestCount,
                location: sessionData.planData.location,
                eventDate: sessionData.planData.eventDate,
                theme: sessionData.planData.theme,
                specialRequirements: sessionData.planData.specialRequirements,
                clientProfile: sessionData.planData.clientProfile,
              },
              aiPlan: sessionData.planData,
              sessionInfo: { planId: crypto.randomUUID() },
            });

            if (savedPlan) {
              convertedPlans.push({
                originalSessionToken: planHistory.sessionToken,
                newPlanId: savedPlan.planId,
                title: savedPlan.title,
                eventType: planHistory.eventType,
                convertedAt: new Date(),
              });
              totalPlansConverted++;
            }
          }
        } catch (error) {
          logger.error("Failed to convert individual plan:", error);
          // Continue with other plans
        }
      }

      // Clean up guest session
      if (this.guestSessions) {
        this.guestSessions.delete(guestSessionToken);
      }

      logger.info("Guest session converted to user account", {
        guestSessionToken: guestSessionToken.substring(0, 10) + "...",
        userId: userContext.userId,
        totalPlansConverted,
      });

      return {
        success: true,
        convertedPlans,
        totalPlansConverted,
        message: `Successfully converted ${totalPlansConverted} plans to your account`,
      };
    } catch (error) {
      logger.error("Failed to convert guest session:", error);
      return {
        success: false,
        message: "Failed to convert guest session",
      };
    }
  }
}

export default new UniversalAIService();
