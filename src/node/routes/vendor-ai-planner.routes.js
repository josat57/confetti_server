import express from "express";
import { protect } from "../middleware/auth.js";
import {
  requireBusinessPlan,
  requireProfessionalPlan,
  requireEnterprisePlan,
} from "../middleware/subscription.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import VendorAIController from "../controllers/vendor-ai-planner.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /vendors/ai-planner/generate:
 *   post:
 *     summary: Generate comprehensive AI event plan (Business+ only)
 *     description: Generate an advanced, AI-powered event plan with intelligent recommendations, visual suggestions, and predictive analytics. Requires Business subscription or higher.
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - eventDate
 *               - guestCount
 *               - budget
 *               - location
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [wedding, birthday, corporate, social, conference, exhibition, other]
 *                 example: wedding
 *               eventDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-06-15T14:00:00Z
 *               guestCount:
 *                 type: number
 *                 minimum: 1
 *                 example: 150
 *               budget:
 *                 type: object
 *                 required:
 *                   - amount
 *                   - currency
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                     example: 50000
 *                   currency:
 *                     type: string
 *                     enum: [NGN, USD, EUR, GBP]
 *                     example: USD
 *               location:
 *                 type: object
 *                 required:
 *                   - city
 *                   - country
 *                 properties:
 *                   city:
 *                     type: string
 *                     example: Lagos
 *                   state:
 *                     type: string
 *                     example: Lagos
 *                   country:
 *                     type: string
 *                     example: Nigeria
 *               theme:
 *                 type: string
 *                 example: elegant garden party
 *               specialRequirements:
 *                 type: string
 *                 example: Wheelchair accessible venue, vegetarian catering
 *               clientProfile:
 *                 type: object
 *                 properties:
 *                   age:
 *                     type: number
 *                   interests:
 *                     type: array
 *                     items:
 *                       type: string
 *                   personality:
 *                     type: string
 *                     enum: [traditional, modern, luxury, casual, creative]
 *                   culturalBackground:
 *                     type: string
 *     responses:
 *       200:
 *         description: Comprehensive AI event plan generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: AI event plan generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     eventPlan:
 *                       type: object
 *                       properties:
 *                         planId:
 *                           type: string
 *                           example: 550e8400-e29b-41d4-a716-446655440000
 *                         clientAnalysis:
 *                           type: object
 *                           properties:
 *                             clientPersonality:
 *                               type: object
 *                             culturalConsiderations:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             hiddenNeeds:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             emotionalJourney:
 *                               type: object
 *                             confidenceScore:
 *                               type: number
 *                               example: 0.87
 *                         marketInsights:
 *                           type: object
 *                           properties:
 *                             demandTrends:
 *                               type: object
 *                             pricingTrends:
 *                               type: object
 *                             opportunityScore:
 *                               type: number
 *                               example: 75
 *                         vendorRecommendations:
 *                           type: object
 *                           properties:
 *                             recommendations:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   vendor:
 *                                     $ref: '#/components/schemas/Vendor'
 *                                   aiScoring:
 *                                     type: object
 *                                     properties:
 *                                       overall:
 *                                         type: number
 *                                         example: 0.92
 *                                       compatibility:
 *                                         type: number
 *                                         example: 0.89
 *                                       quality:
 *                                         type: number
 *                                         example: 0.95
 *                                   recommendationReason:
 *                                     type: string
 *                                     example: Excellent match for elegant events with strong client reviews
 *                         budgetOptimization:
 *                           type: object
 *                           properties:
 *                             aiRecommendedAllocation:
 *                               type: object
 *                             riskAdjustedBudget:
 *                               type: object
 *                             costSavingStrategies:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             optimizationScore:
 *                               type: number
 *                               example: 0.85
 *                         visualSuggestions:
 *                           type: object
 *                           properties:
 *                             colorPalette:
 *                               type: array
 *                               items:
 *                                 type: string
 *                               example: ["#E8F4F8", "#D4E6F1", "#A9CCE3"]
 *                             moodBoardConcepts:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             customMoodBoard:
 *                               type: object
 *                               description: Available for Business+ plans
 *                         intelligentTimeline:
 *                           type: object
 *                           properties:
 *                             phases:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             criticalPath:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             riskWindows:
 *                               type: array
 *                               items:
 *                                 type: object
 *                         riskAnalysis:
 *                           type: object
 *                           properties:
 *                             overallRiskScore:
 *                               type: number
 *                               example: 0.25
 *                             riskCategories:
 *                               type: object
 *                             mitigationStrategies:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         aiLearningInsights:
 *                           type: object
 *                           properties:
 *                             personalizedRecommendations:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             learningProgress:
 *                               type: string
 *                               example: proficient
 *                     planFeatures:
 *                       type: object
 *                       description: Available features based on subscription plan
 *                     processingTime:
 *                       type: number
 *                       example: 3450
 *                       description: Processing time in milliseconds
 *       403:
 *         description: Requires Business subscription or higher
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post(
  "/generate",
  requireBusinessPlan,
  rateLimiter("vendor-ai-generate", 10, 60 * 60), // 10 requests per hour
  VendorAIController.generateEventPlan
);

/**
 * @swagger
 * /vendors/ai-planner/analyze-client:
 *   post:
 *     summary: Analyze client requirements with AI (Business+ only)
 *     description: Use advanced AI to analyze client requirements, personality, and preferences for better event planning
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientDescription
 *               - eventRequirements
 *             properties:
 *               clientDescription:
 *                 type: string
 *                 example: Young professional couple, loves modern design, eco-conscious
 *               eventRequirements:
 *                 type: string
 *                 example: Outdoor wedding, 100 guests, sustainable practices important
 *               budget:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                   currency:
 *                     type: string
 *               additionalContext:
 *                 type: string
 *                 example: First-time event planners, need guidance
 *     responses:
 *       200:
 *         description: Client analysis completed successfully
 *       403:
 *         description: Requires Business subscription or higher
 */
router.post(
  "/analyze-client",
  requireBusinessPlan,
  rateLimiter("vendor-ai-analyze", 20, 60 * 60), // 20 requests per hour
  VendorAIController.analyzeClientRequirements
);

/**
 * @swagger
 * /vendors/ai-planner/recommend-vendors:
 *   post:
 *     summary: Get AI-powered vendor recommendations (Business+ only)
 *     description: Generate intelligent vendor recommendations with compatibility scoring and collaboration suggestions
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - location
 *               - budget
 *             properties:
 *               eventType:
 *                 type: string
 *               location:
 *                 type: object
 *               budget:
 *                 type: object
 *               clientPreferences:
 *                 type: object
 *               excludeCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Vendor recommendations generated successfully
 *       403:
 *         description: Requires Business subscription or higher
 */
router.post(
  "/recommend-vendors",
  requireBusinessPlan,
  rateLimiter("vendor-ai-recommend", 15, 60 * 60), // 15 requests per hour
  VendorAIController.recommendVendors
);

/**
 * @swagger
 * /vendors/ai-planner/optimize-budget:
 *   post:
 *     summary: AI-powered budget optimization (Business+ only)
 *     description: Optimize event budget using AI predictions, market insights, and risk analysis
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - budget
 *               - eventType
 *               - guestCount
 *             properties:
 *               budget:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                   currency:
 *                     type: string
 *               eventType:
 *                 type: string
 *               guestCount:
 *                 type: number
 *               location:
 *                 type: object
 *               priorities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Budget optimization completed successfully
 *       403:
 *         description: Requires Business subscription or higher
 */
router.post(
  "/optimize-budget",
  requireBusinessPlan,
  rateLimiter("vendor-ai-budget", 15, 60 * 60), // 15 requests per hour
  VendorAIController.optimizeBudget
);

/**
 * @swagger
 * /vendors/ai-planner/generate-timeline:
 *   post:
 *     summary: Generate intelligent event timeline (Business+ only)
 *     description: Create AI-powered event timeline with risk assessment and predictive scheduling
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventDate
 *               - eventType
 *             properties:
 *               eventDate:
 *                 type: string
 *                 format: date-time
 *               eventType:
 *                 type: string
 *               complexity:
 *                 type: string
 *                 enum: [simple, moderate, complex]
 *               vendorCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Intelligent timeline generated successfully
 *       403:
 *         description: Requires Business subscription or higher
 */
router.post(
  "/generate-timeline",
  requireBusinessPlan,
  rateLimiter("vendor-ai-timeline", 15, 60 * 60), // 15 requests per hour
  VendorAIController.generateTimeline
);

/**
 * @swagger
 * /vendors/ai-planner/market-insights:
 *   get:
 *     summary: Get AI-powered market insights (Business+ only)
 *     description: Access real-time market insights, trends, and opportunities powered by AI analysis
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Location for market analysis
 *         example: Lagos, Nigeria
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Event type for analysis
 *         example: wedding
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, quarterly]
 *         description: Analysis timeframe
 *         example: monthly
 *     responses:
 *       200:
 *         description: Market insights retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     insights:
 *                       type: object
 *                       properties:
 *                         marketScore:
 *                           type: number
 *                           example: 78
 *                         demandTrends:
 *                           type: object
 *                         pricingTrends:
 *                           type: object
 *                         opportunities:
 *                           type: array
 *                           items:
 *                             type: object
 *                         risks:
 *                           type: array
 *                           items:
 *                             type: object
 *                         predictions:
 *                           type: array
 *                           items:
 *                             type: object
 *       403:
 *         description: Requires Business subscription or higher
 */
router.get(
  "/market-insights",
  requireBusinessPlan,
  rateLimiter("vendor-ai-insights", 30, 60 * 60), // 30 requests per hour
  VendorAIController.getMarketInsights
);

/**
 * @swagger
 * /vendors/ai-planner/generate-proposal:
 *   post:
 *     summary: Generate AI-powered proposal (Business+ only)
 *     description: Create intelligent, personalized proposals using AI analysis of client needs and market data
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientInfo
 *               - eventDetails
 *               - services
 *             properties:
 *               clientInfo:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   preferences:
 *                     type: object
 *               eventDetails:
 *                 type: object
 *                 properties:
 *                   eventType:
 *                     type: string
 *                   date:
 *                     type: string
 *                   guestCount:
 *                     type: number
 *                   budget:
 *                     type: object
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *               customization:
 *                 type: object
 *                 properties:
 *                   tone:
 *                     type: string
 *                     enum: [professional, friendly, luxury, casual]
 *                   includeVisuals:
 *                     type: boolean
 *                   includePricing:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: AI proposal generated successfully
 *       403:
 *         description: Requires Business subscription or higher
 */
router.post(
  "/generate-proposal",
  requireBusinessPlan,
  rateLimiter("vendor-ai-proposal", 10, 60 * 60), // 10 requests per hour
  VendorAIController.generateProposal
);

/**
 * @swagger
 * /vendors/ai-planner/learning-insights:
 *   get:
 *     summary: Get AI learning insights and recommendations (Business+ only)
 *     description: Access personalized insights from AI learning model about vendor performance and improvement opportunities
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Learning insights retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     insights:
 *                       type: object
 *                       properties:
 *                         learningProgress:
 *                           type: string
 *                           example: proficient
 *                         modelHealth:
 *                           type: string
 *                           example: good
 *                         strengths:
 *                           type: array
 *                           items:
 *                             type: string
 *                         improvementAreas:
 *                           type: array
 *                           items:
 *                             type: string
 *                         personalizedRecommendations:
 *                           type: array
 *                           items:
 *                             type: string
 *                         successPatterns:
 *                           type: array
 *                           items:
 *                             type: object
 *                         performanceMetrics:
 *                           type: object
 *       403:
 *         description: Requires Business subscription or higher
 */
router.get(
  "/learning-insights",
  requireBusinessPlan,
  rateLimiter("vendor-ai-learning", 20, 60 * 60), // 20 requests per hour
  VendorAIController.getLearningInsights
);

/**
 * @swagger
 * /vendors/ai-planner/train-model:
 *   post:
 *     summary: Train AI model with vendor data (Professional+ only)
 *     description: Train the AI model with vendor-specific data for improved personalization and accuracy
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trainingData
 *             properties:
 *               trainingData:
 *                 type: object
 *                 properties:
 *                   events:
 *                     type: array
 *                     items:
 *                       type: object
 *                   clientFeedback:
 *                     type: array
 *                     items:
 *                       type: object
 *                   preferences:
 *                     type: object
 *               trainingType:
 *                 type: string
 *                 enum: [incremental, full, specialized]
 *                 default: incremental
 *     responses:
 *       200:
 *         description: AI model training completed successfully
 *       403:
 *         description: Requires Professional subscription or higher
 */
router.post(
  "/train-model",
  requireProfessionalPlan,
  rateLimiter("vendor-ai-train", 5, 24 * 60 * 60), // 5 requests per day
  VendorAIController.trainModel
);

/**
 * @swagger
 * /vendors/ai-planner/model-metrics:
 *   get:
 *     summary: Get AI model performance metrics (Professional+ only)
 *     description: Access detailed performance metrics and analytics for the vendor's AI model
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Model metrics retrieved successfully
 *       403:
 *         description: Requires Professional subscription or higher
 */
router.get(
  "/model-metrics",
  requireProfessionalPlan,
  rateLimiter("vendor-ai-metrics", 50, 60 * 60), // 50 requests per hour
  VendorAIController.getModelMetrics
);

/**
 * @swagger
 * /vendors/ai-planner/visual-suggestions:
 *   post:
 *     summary: Generate AI visual suggestions (Business+ only)
 *     description: Generate intelligent visual suggestions including color palettes, mood boards, and design concepts
 *     tags: [Vendor AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - theme
 *             properties:
 *               eventType:
 *                 type: string
 *               theme:
 *                 type: string
 *                 example: rustic elegance
 *               colorPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *               budget:
 *                 type: object
 *               venue:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                   style:
 *                     type: string
 *     responses:
 *       200:
 *         description: Visual suggestions generated successfully
 *       403:
 *         description: Requires Business subscription or higher
 */
router.post(
  "/visual-suggestions",
  requireBusinessPlan,
  rateLimiter("vendor-ai-visual", 20, 60 * 60), // 20 requests per hour
  VendorAIController.generateVisualSuggestions
);

export default router;
