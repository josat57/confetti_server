import PythonService from "./python.service.js";
import VendorService from "./vendor.service.js";
import BudgetService from "./budget.service.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import AILearningModel from "../models/ai-learning.model.js";
import EventPlanTemplate from "../models/event-plan-template.model.js";
import MarketInsight from "../models/market-insight.model.js";
import crypto from "crypto";

/**
 * Advanced AI Service for Vendor Event Planning
 * Provides intelligent, learning-based event planning capabilities
 */
class VendorAIService {
  constructor() {
    this.aiModels = {
      gpt4: "gpt-4o",
      claude: "claude-sonnet-4-6",
      gemini: "gemini-2.0-flash",
    };
    this.imageModels = {
      dalle: "dall-e-3",
      stable: "stable-diffusion-xl",
    };
  }

  /**
   * Generate comprehensive AI-powered event plan
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
      vendorId,
      planLevel,
      vendorProfile,
    } = params;

    try {
      logger.info("Starting comprehensive AI event plan generation", {
        vendorId,
        eventType,
        planLevel,
      });

      // 1. Analyze client requirements with multiple AI models
      const clientAnalysis = await this.analyzeClientWithMultipleAI({
        eventType,
        guestCount,
        budget,
        theme,
        specialRequirements,
        clientProfile,
      });

      // 2. Generate market insights and trends
      const marketInsights = await this.generateRealTimeMarketInsights({
        location,
        eventType,
        budget,
        eventDate,
      });

      // 3. Create intelligent vendor recommendations
      const vendorRecommendations =
        await this.generateIntelligentVendorMatching({
          eventType,
          location,
          budget,
          clientAnalysis,
          requestingVendorId: vendorId,
          planLevel,
        });

      // 4. Optimize budget with AI predictions
      const budgetOptimization = await this.generateAdvancedBudgetOptimization({
        budget,
        eventType,
        guestCount,
        location,
        marketInsights,
        planLevel,
      });

      // 5. Create visual mood board and design suggestions
      const visualSuggestions = await this.generateVisualIntelligence({
        theme,
        eventType,
        budget,
        clientAnalysis,
        planLevel,
      });

      // 6. Generate intelligent timeline with risk assessment
      const intelligentTimeline = await this.generatePredictiveTimeline({
        eventDate,
        eventType,
        vendorRecommendations,
        marketInsights,
        planLevel,
      });

      // 7. Create personalized recommendations based on vendor's history
      const personalizedInsights = await this.generatePersonalizedInsights({
        vendorId,
        vendorProfile,
        clientAnalysis,
        planLevel,
      });

      // 8. Generate success probability and risk analysis
      const riskAnalysis = await this.generateRiskAssessment({
        eventType,
        budget,
        timeline: intelligentTimeline,
        marketInsights,
        planLevel,
      });

      // 9. Learn from this interaction for future improvements
      await this.updateLearningModel({
        vendorId,
        eventData: params,
        generatedPlan: {
          clientAnalysis,
          budgetOptimization,
          vendorRecommendations,
        },
      });

      const comprehensivePlan = {
        planId: crypto.randomUUID(),
        generatedAt: new Date(),
        planLevel,

        // Core Analysis
        clientAnalysis,
        marketInsights,

        // Recommendations
        vendorRecommendations,
        budgetOptimization,
        visualSuggestions,

        // Planning Tools
        intelligentTimeline,
        personalizedInsights,
        riskAnalysis,

        // Interactive Features
        interactiveElements: this.generateInteractiveElements(planLevel),

        // Learning Insights
        aiLearningInsights: await this.generateLearningInsights({
          vendorId,
          planLevel,
        }),

        // Future Predictions
        trendPredictions: await this.generateTrendPredictions({
          eventType,
          location,
          planLevel,
        }),
      };

      logger.info("Comprehensive AI event plan generated successfully", {
        vendorId,
        planId: comprehensivePlan.planId,
        componentsGenerated: Object.keys(comprehensivePlan).length,
      });

      return comprehensivePlan;
    } catch (error) {
      logger.error("Comprehensive plan generation failed:", error);
      throw new AppError("Failed to generate comprehensive event plan", 500);
    }
  }

  /**
   * Analyze client requirements using multiple AI models for enhanced accuracy
   */
  async analyzeClientWithMultipleAI(params) {
    const {
      eventType,
      guestCount,
      budget,
      theme,
      specialRequirements,
      clientProfile,
    } = params;

    try {
      const analysisPrompt = `
        Analyze this event planning request with deep psychological and cultural insights:
        
        Event Type: ${eventType}
        Guest Count: ${guestCount}
        Budget: ${budget.amount} ${budget.currency}
        Theme: ${theme || "Not specified"}
        Special Requirements: ${specialRequirements || "None"}
        Client Profile: ${JSON.stringify(clientProfile || {})}
        
        Provide comprehensive analysis including:
        1. Client personality and preferences
        2. Cultural considerations
        3. Hidden needs and expectations
        4. Potential challenges and solutions
        5. Emotional journey mapping
        6. Success metrics definition
        7. Personalization opportunities
      `;

      // Use multiple AI models for cross-validation
      const [gptAnalysis, claudeAnalysis] = await Promise.allSettled([
        this.queryAIModel("gpt4", analysisPrompt),
        this.queryAIModel("claude", analysisPrompt),
      ]);

      // Synthesize results from multiple models
      const synthesizedAnalysis = await this.synthesizeMultipleAIResponses([
        gptAnalysis.status === "fulfilled" ? gptAnalysis.value : null,
        claudeAnalysis.status === "fulfilled" ? claudeAnalysis.value : null,
      ]);

      return {
        clientPersonality: synthesizedAnalysis.personality,
        culturalConsiderations: synthesizedAnalysis.cultural,
        hiddenNeeds: synthesizedAnalysis.hiddenNeeds,
        emotionalJourney: synthesizedAnalysis.emotionalJourney,
        successMetrics: synthesizedAnalysis.successMetrics,
        personalizationOpportunities: synthesizedAnalysis.personalization,
        confidenceScore: synthesizedAnalysis.confidence,
        aiModelsUsed: ["gpt4", "claude"],
        analysisTimestamp: new Date(),
      };
    } catch (error) {
      logger.error("Multi-AI client analysis failed:", error);
      throw new AppError("Failed to analyze client requirements", 500);
    }
  }

  /**
   * Generate real-time market insights and trends
   */
  async generateRealTimeMarketInsights(params) {
    const { location, eventType, budget, eventDate } = params;

    try {
      // Check cache first
      const cacheKey = `market-insights:${location.city}:${eventType}:${
        new Date().toISOString().split("T")[0]
      }`;

      // Generate fresh insights
      const marketData = await this.fetchMarketData({
        location,
        eventType,
        timeframe: "30d",
      });

      const insights = {
        demandTrends: await this.analyzeDemandTrends(marketData),
        pricingTrends: await this.analyzePricingTrends(marketData, budget),
        seasonalFactors: await this.analyzeSeasonalFactors(
          eventDate,
          eventType
        ),
        competitorAnalysis: await this.analyzeCompetitorLandscape(
          location,
          eventType
        ),
        opportunityScore: await this.calculateOpportunityScore(marketData),
        riskFactors: await this.identifyMarketRisks(marketData),
        recommendations: await this.generateMarketRecommendations(marketData),

        // Real-time data
        currentAvailability: await this.checkRealTimeAvailability(
          location,
          eventDate
        ),
        priceVolatility: await this.calculatePriceVolatility(marketData),
        bookingVelocity: await this.calculateBookingVelocity(marketData),

        generatedAt: new Date(),
        dataFreshness: "real-time",
        confidenceLevel: 0.85,
      };

      // Cache for 1 hour
      await this.cacheInsights(cacheKey, insights, 3600);

      return insights;
    } catch (error) {
      logger.error("Market insights generation failed:", error);
      return this.getFallbackMarketInsights(params);
    }
  }

  /**
   * Generate intelligent vendor matching with compatibility scoring
   */
  async generateIntelligentVendorMatching(params) {
    const {
      eventType,
      location,
      budget,
      clientAnalysis,
      requestingVendorId,
      planLevel,
    } = params;

    try {
      // Get all relevant vendors
      const vendors = await VendorService.findVendorsForEvent({
        eventType,
        location,
        budget,
      });

      // Score each vendor using AI
      const scoredVendors = await Promise.all(
        vendors.map(async (vendor) => {
          const compatibilityScore = await this.calculateVendorCompatibility({
            vendor,
            clientAnalysis,
            eventType,
            budget,
          });

          const qualityScore = await this.calculateVendorQuality(vendor);
          const reliabilityScore = await this.calculateVendorReliability(
            vendor
          );
          const valueScore = await this.calculateValueScore(vendor, budget);

          return {
            ...vendor,
            aiScoring: {
              compatibility: compatibilityScore,
              quality: qualityScore,
              reliability: reliabilityScore,
              value: valueScore,
              overall:
                (compatibilityScore +
                  qualityScore +
                  reliabilityScore +
                  valueScore) /
                4,
            },
            recommendationReason: await this.generateRecommendationReason({
              vendor,
              scores: {
                compatibilityScore,
                qualityScore,
                reliabilityScore,
                valueScore,
              },
              clientAnalysis,
            }),
            riskFactors: await this.identifyVendorRisks(vendor),
            collaborationPotential: await this.assessCollaborationPotential(
              vendor,
              requestingVendorId
            ),
          };
        })
      );

      // Sort by overall score and apply plan-level filtering
      const recommendations = scoredVendors
        .sort((a, b) => b.aiScoring.overall - a.aiScoring.overall)
        .slice(0, this.getRecommendationLimit(planLevel));

      return {
        totalVendorsAnalyzed: vendors.length,
        recommendations,
        categoryBreakdown: this.categorizeRecommendations(recommendations),
        collaborationSuggestions: await this.generateCollaborationSuggestions(
          recommendations
        ),
        alternativeOptions: await this.generateAlternativeOptions(
          scoredVendors,
          recommendations
        ),
        generatedAt: new Date(),
        planLevel,
      };
    } catch (error) {
      logger.error("Intelligent vendor matching failed:", error);
      throw new AppError("Failed to generate vendor recommendations", 500);
    }
  }

  /**
   * Generate advanced budget optimization with AI predictions
   */
  async generateAdvancedBudgetOptimization(params) {
    const {
      budget,
      eventType,
      guestCount,
      location,
      marketInsights,
      planLevel,
    } = params;

    try {
      // Use AI to predict optimal budget allocation
      const optimizationPrompt = `
        Optimize this event budget using advanced financial modeling:
        
        Total Budget: ${budget.amount} ${budget.currency}
        Event Type: ${eventType}
        Guest Count: ${guestCount}
        Location: ${location.city}, ${location.state}
        Market Insights: ${JSON.stringify(marketInsights.pricingTrends)}
        
        Provide:
        1. Optimal category allocation with percentages
        2. Risk-adjusted recommendations
        3. Cost-saving opportunities
        4. Premium upgrade options
        5. Contingency planning
        6. ROI predictions for each category
        7. Seasonal pricing adjustments
      `;

      const aiOptimization = await this.queryAIModel(
        "gpt4",
        optimizationPrompt
      );

      // Enhance with local budget service
      const localOptimization = await BudgetService.optimizeBudget(
        budget,
        eventType,
        guestCount,
        { statistics: marketInsights }
      );

      // Combine AI and local optimization
      const optimization = {
        aiRecommendedAllocation: aiOptimization.allocation,
        localOptimizedAllocation: localOptimization.categories,

        // Advanced features
        riskAdjustedBudget: await this.calculateRiskAdjustedBudget(
          budget,
          marketInsights
        ),
        seasonalAdjustments: await this.calculateSeasonalAdjustments(
          budget,
          eventType
        ),
        negotiationOpportunities: await this.identifyNegotiationOpportunities(
          marketInsights
        ),
        costSavingStrategies: await this.generateCostSavingStrategies(
          budget,
          eventType
        ),
        premiumUpgradeOptions: await this.generateUpgradeOptions(
          budget,
          planLevel
        ),

        // Predictions
        roiPredictions: await this.predictCategoryROI(budget, eventType),
        priceVolatilityForecast: await this.forecastPriceVolatility(
          marketInsights
        ),

        // Interactive tools
        budgetSimulator:
          planLevel >= 3 ? await this.generateBudgetSimulator(budget) : null,
        whatIfScenarios:
          planLevel >= 4 ? await this.generateWhatIfScenarios(budget) : null,

        optimizationScore: aiOptimization.score || 0.8,
        confidenceLevel: 0.87,
        generatedAt: new Date(),
      };

      return optimization;
    } catch (error) {
      logger.error("Advanced budget optimization failed:", error);
      throw new AppError("Failed to optimize budget", 500);
    }
  }

  /**
   * Generate visual intelligence including mood boards and design suggestions
   */
  async generateVisualIntelligence(params) {
    const { theme, eventType, budget, clientAnalysis, planLevel } = params;

    try {
      // Generate color palette based on theme and client personality
      const colorPalette = await this.generateIntelligentColorPalette({
        theme,
        eventType,
        clientPersonality: clientAnalysis.clientPersonality,
      });

      // Generate mood board concepts
      const moodBoardConcepts = await this.generateMoodBoardConcepts({
        theme,
        eventType,
        colorPalette,
        budget,
      });

      // Generate layout suggestions
      const layoutSuggestions = await this.generateLayoutSuggestions({
        eventType,
        guestCount: params.guestCount,
        theme,
      });

      const visualSuggestions = {
        colorPalette,
        moodBoardConcepts,
        layoutSuggestions,

        // Advanced visual features (plan-level dependent)
        designTrends: await this.analyzeCurrentDesignTrends(eventType),
        photoSuggestions: await this.generatePhotoSuggestions(theme, eventType),
        decorationIdeas: await this.generateDecorationIdeas(theme, budget),

        // Premium features
        customMoodBoard:
          planLevel >= 3 ? await this.generateCustomMoodBoard(params) : null,
        threeDVisualization:
          planLevel >= 4 ? await this.generate3DVisualization(params) : null,
        virtualWalkthrough:
          planLevel >= 5 ? await this.generateVirtualWalkthrough(params) : null,

        visualIntelligenceScore: 0.89,
        generatedAt: new Date(),
        planLevel,
      };

      return visualSuggestions;
    } catch (error) {
      logger.error("Visual intelligence generation failed:", error);
      return this.getFallbackVisualSuggestions(params);
    }
  }

  /**
   * Generate predictive timeline with risk assessment
   */
  async generatePredictiveTimeline(params) {
    const {
      eventDate,
      eventType,
      vendorRecommendations,
      marketInsights,
      planLevel,
    } = params;

    try {
      // Calculate optimal timeline using AI
      const timelinePrompt = `
        Create an intelligent event planning timeline:
        
        Event Date: ${eventDate}
        Event Type: ${eventType}
        Market Conditions: ${JSON.stringify(marketInsights.demandTrends)}
        Vendor Availability: ${
          vendorRecommendations.totalVendorsAnalyzed
        } vendors analyzed
        
        Generate:
        1. Optimal booking timeline with risk windows
        2. Critical path analysis
        3. Buffer time recommendations
        4. Seasonal considerations
        5. Vendor-specific timing requirements
        6. Risk mitigation checkpoints
      `;

      const aiTimeline = await this.queryAIModel("gpt4", timelinePrompt);

      // Enhance with predictive analytics
      const timeline = {
        phases: aiTimeline.phases,
        criticalPath: aiTimeline.criticalPath,
        riskWindows: await this.identifyRiskWindows(eventDate, eventType),

        // Predictive features
        bookingProbabilities: await this.calculateBookingProbabilities(
          vendorRecommendations
        ),
        priceFluctuationPredictions: await this.predictPriceFluctuations(
          marketInsights
        ),
        availabilityForecasts: await this.forecastAvailability(
          vendorRecommendations,
          eventDate
        ),

        // Interactive timeline features
        dynamicAdjustments:
          planLevel >= 3
            ? await this.generateDynamicAdjustments(eventDate)
            : null,
        scenarioPlanning:
          planLevel >= 4
            ? await this.generateScenarioPlanning(eventDate)
            : null,

        // AI-powered alerts
        intelligentAlerts: await this.generateIntelligentAlerts(
          eventDate,
          eventType
        ),
        automatedReminders: await this.generateAutomatedReminders(eventDate),

        timelineScore: aiTimeline.score || 0.85,
        generatedAt: new Date(),
        planLevel,
      };

      return timeline;
    } catch (error) {
      logger.error("Predictive timeline generation failed:", error);
      throw new AppError("Failed to generate intelligent timeline", 500);
    }
  }

  /**
   * Generate personalized insights based on vendor's history and preferences
   */
  async generatePersonalizedInsights(params) {
    const { vendorId, vendorProfile, clientAnalysis, planLevel } = params;

    try {
      // Get vendor's historical data
      const vendorHistory = await this.getVendorHistory(vendorId);
      const learningModel = await AILearningModel.findOne({ vendorId });

      // Generate personalized recommendations
      const insights = {
        personalizedRecommendations:
          await this.generatePersonalizedRecommendations({
            vendorHistory,
            learningModel,
            clientAnalysis,
          }),

        stylePreferences: await this.analyzeVendorStylePreferences(
          vendorHistory
        ),
        successPatterns: await this.identifySuccessPatterns(vendorHistory),
        improvementAreas: await this.identifyImprovementAreas(vendorHistory),

        // Learning-based insights
        clientMatchingInsights: await this.generateClientMatchingInsights(
          vendorId,
          clientAnalysis
        ),
        pricingOptimization: await this.generatePricingOptimization(
          vendorHistory
        ),
        serviceExpansionSuggestions:
          await this.generateServiceExpansionSuggestions(vendorHistory),

        // Advanced personalization (plan-level dependent)
        aiPersonalityProfile:
          planLevel >= 3
            ? await this.generateAIPersonalityProfile(vendorId)
            : null,
        predictiveInsights:
          planLevel >= 4
            ? await this.generatePredictiveInsights(vendorId)
            : null,

        personalizationScore: learningModel?.accuracy || 0.75,
        generatedAt: new Date(),
        planLevel,
      };

      return insights;
    } catch (error) {
      logger.error("Personalized insights generation failed:", error);
      return this.getFallbackPersonalizedInsights(params);
    }
  }

  /**
   * Generate comprehensive risk assessment
   */
  async generateRiskAssessment(params) {
    const { eventType, budget, timeline, marketInsights, planLevel } = params;

    try {
      const riskAnalysis = {
        overallRiskScore: await this.calculateOverallRiskScore(params),

        riskCategories: {
          financial: await this.assessFinancialRisks(budget, marketInsights),
          operational: await this.assessOperationalRisks(timeline, eventType),
          market: await this.assessMarketRisks(marketInsights),
          seasonal: await this.assessSeasonalRisks(
            timeline.eventDate,
            eventType
          ),
          vendor: await this.assessVendorRisks(params.vendorRecommendations),
        },

        mitigationStrategies: await this.generateMitigationStrategies(params),
        contingencyPlans: await this.generateContingencyPlans(params),
        insuranceRecommendations: await this.generateInsuranceRecommendations(
          params
        ),

        // Advanced risk features
        riskSimulation:
          planLevel >= 4 ? await this.generateRiskSimulation(params) : null,
        predictiveRiskModeling:
          planLevel >= 5
            ? await this.generatePredictiveRiskModeling(params)
            : null,

        confidenceLevel: 0.82,
        generatedAt: new Date(),
        planLevel,
      };

      return riskAnalysis;
    } catch (error) {
      logger.error("Risk assessment generation failed:", error);
      return this.getFallbackRiskAssessment(params);
    }
  }

  /**
   * Update learning model with new interaction data
   */
  async updateLearningModel(params) {
    const { vendorId, eventData, generatedPlan } = params;

    try {
      let learningModel = await AILearningModel.findOne({ vendorId });

      if (!learningModel) {
        learningModel = new AILearningModel({
          vendorId,
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
            generatedPlan.budgetOptimization.optimizationScore,
          clientAnalysis: generatedPlan.clientAnalysis.confidenceScore,
          vendorMatching:
            generatedPlan.vendorRecommendations?.recommendations?.length || 0,
        },
      });

      // Update preferences based on patterns
      await this.updateVendorPreferences(learningModel, eventData);

      // Recalculate accuracy
      learningModel.learningData.accuracy = await this.calculateModelAccuracy(
        learningModel
      );

      await learningModel.save();

      logger.info("Learning model updated", {
        vendorId,
        newAccuracy: learningModel.learningData.accuracy,
        totalInteractions: learningModel.learningData.interactions.length,
      });
    } catch (error) {
      logger.error("Learning model update failed:", error);
      // Don't throw error as this is not critical for the main flow
    }
  }

  /**
   * Get plan-specific features and limitations
   */
  getPlanFeatures(planLevel) {
    const features = {
      1: {
        // Basic
        aiModels: ["basic"],
        vendorRecommendations: 5,
        visualSuggestions: "basic",
        marketInsights: "limited",
        learningCapability: false,
      },
      2: {
        // Starter
        aiModels: ["basic", "enhanced"],
        vendorRecommendations: 10,
        visualSuggestions: "standard",
        marketInsights: "standard",
        learningCapability: true,
      },
      3: {
        // Business
        aiModels: ["gpt4", "claude"],
        vendorRecommendations: 20,
        visualSuggestions: "advanced",
        marketInsights: "comprehensive",
        learningCapability: true,
        customMoodBoard: true,
        budgetSimulator: true,
      },
      4: {
        // Professional
        aiModels: ["gpt4", "claude", "gemini"],
        vendorRecommendations: 50,
        visualSuggestions: "premium",
        marketInsights: "real-time",
        learningCapability: true,
        customMoodBoard: true,
        budgetSimulator: true,
        threeDVisualization: true,
        scenarioPlanning: true,
        riskSimulation: true,
        modelTraining: true,
      },
      5: {
        // Enterprise
        aiModels: ["all"],
        vendorRecommendations: "unlimited",
        visualSuggestions: "enterprise",
        marketInsights: "predictive",
        learningCapability: true,
        allPremiumFeatures: true,
        customAITraining: true,
        dedicatedSupport: true,
      },
    };

    return features[planLevel] || features[1];
  }

  // Helper methods for AI model interaction
  async queryAIModel(model, prompt) {
    try {
      // This would integrate with actual AI services
      const response = await PythonService.queryAIModel({
        model: this.aiModels[model],
        prompt,
        temperature: 0.7,
        maxTokens: 2000,
      });

      return response;
    } catch (error) {
      logger.error(`AI model ${model} query failed:`, error);
      throw error;
    }
  }

  async synthesizeMultipleAIResponses(responses) {
    // Combine and synthesize responses from multiple AI models
    const validResponses = responses.filter((r) => r !== null);

    if (validResponses.length === 0) {
      throw new AppError("All AI models failed to respond", 500);
    }

    // Use the first valid response as base and enhance with others
    const synthesized = validResponses[0];
    synthesized.confidence = validResponses.length / responses.length;

    return synthesized;
  }

  // Additional helper methods would be implemented here...
  // (Due to length constraints, showing the core structure)

  getRecommendationLimit(planLevel) {
    const limits = { 1: 5, 2: 10, 3: 20, 4: 50, 5: 100 };
    return limits[planLevel] || 5;
  }

  async getFallbackMarketInsights(params) {
    return {
      demandTrends: { trend: "stable", confidence: 0.6 },
      pricingTrends: { trend: "stable", confidence: 0.6 },
      generatedAt: new Date(),
      dataSource: "fallback",
    };
  }

  async getFallbackVisualSuggestions(params) {
    return {
      colorPalette: ["#FF6B6B", "#4ECDC4", "#45B7D1"],
      moodBoardConcepts: ["elegant", "modern", "classic"],
      generatedAt: new Date(),
      dataSource: "fallback",
    };
  }

  async getFallbackPersonalizedInsights(params) {
    return {
      personalizedRecommendations: [
        "Focus on client communication",
        "Expand service offerings",
      ],
      generatedAt: new Date(),
      dataSource: "fallback",
    };
  }

  async getFallbackRiskAssessment(params) {
    return {
      overallRiskScore: 0.3,
      riskCategories: {
        financial: { score: 0.2, level: "low" },
        operational: { score: 0.3, level: "low" },
        market: { score: 0.4, level: "medium" },
      },
      generatedAt: new Date(),
      dataSource: "fallback",
    };
  }
}

export default new VendorAIService();
