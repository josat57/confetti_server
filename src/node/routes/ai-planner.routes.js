import express from "express";
import UniversalAIController from "../controllers/universal-ai-planner.controller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { protect as authenticate, optionalAuth } from "../middleware/auth.js";
import {
  requireBusinessPlan,
  requireProfessionalPlan,
  requireEnterprisePlan,
} from "../middleware/subscription.js";

const router = express.Router();

/**
 * @swagger
 * /ai-planner/generate:
 *   post:
 *     summary: Generate comprehensive AI event plan (Universal - All Users)
 *     description: Generate an advanced, AI-powered event plan with intelligent recommendations, visual suggestions, and predictive analytics. Available to all users with features based on authentication status and subscription plan.
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *       - {}
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
 *                       description: Comprehensive event plan with features based on user type and plan level
 *                     userContext:
 *                       type: object
 *                       properties:
 *                         userType:
 *                           type: string
 *                           enum: [guest, user, vendor, planner, admin]
 *                         planLevel:
 *                           type: number
 *                           example: 3
 *                         availableFeatures:
 *                           type: object
 *                     processingTime:
 *                       type: number
 *                       example: 3450
 *       429:
 *         description: Rate limit exceeded or usage quota reached
 *       500:
 *         description: Internal server error
 */
router.post(
  "/generate",
  optionalAuth, // Supports both authenticated and unauthenticated users
  rateLimiter("ai-planner-generate", 10, 60 * 60), // 10 requests per hour
  UniversalAIController.generateEventPlan
);

/**
 * @swagger
 * /ai-planner/analyze-client:
 *   post:
 *     summary: Analyze client requirements with AI (All Users)
 *     description: Use advanced AI to analyze client requirements, personality, and preferences for better event planning
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *       - {}
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
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  "/analyze-client",
  optionalAuth,
  rateLimiter("ai-planner-analyze", 20, 60 * 60), // 20 requests per hour
  UniversalAIController.analyzeClientRequirements
);

/**
 * @swagger
 * /ai-planner/recommend-vendors:
 *   post:
 *     summary: Get AI-powered vendor recommendations (All Users)
 *     description: Generate intelligent vendor recommendations with compatibility scoring and collaboration suggestions
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *       - {}
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
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  "/recommend-vendors",
  optionalAuth,
  rateLimiter("ai-planner-recommend", 15, 60 * 60), // 15 requests per hour
  UniversalAIController.recommendVendors
);

/**
 * @swagger
 * /ai-planner/optimize-budget:
 *   post:
 *     summary: AI-powered budget optimization (All Users)
 *     description: Optimize event budget using AI predictions, market insights, and risk analysis
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *       - {}
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
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  "/optimize-budget",
  optionalAuth,
  rateLimiter("ai-planner-budget", 15, 60 * 60), // 15 requests per hour
  UniversalAIController.optimizeBudget
);

/**
 * @swagger
 * /ai-planner/generate-timeline:
 *   post:
 *     summary: Generate intelligent event timeline (All Users)
 *     description: Create AI-powered event timeline with risk assessment and predictive scheduling
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *       - {}
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
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  "/generate-timeline",
  optionalAuth,
  rateLimiter("ai-planner-timeline", 15, 60 * 60), // 15 requests per hour
  UniversalAIController.generateTimeline
);

/**
 * @swagger
 * /ai-planner/market-insights:
 *   get:
 *     summary: Get AI-powered market insights (Starter+ Users)
 *     description: Access real-time market insights, trends, and opportunities powered by AI analysis
 *     tags: [Universal AI Planner]
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
 *       403:
 *         description: Requires Starter plan or higher
 */
router.get(
  "/market-insights",
  authenticate,
  rateLimiter("ai-planner-insights", 30, 60 * 60), // 30 requests per hour
  UniversalAIController.getMarketInsights
);

/**
 * @swagger
 * /ai-planner/generate-proposal:
 *   post:
 *     summary: Generate AI-powered proposal (Authenticated Users)
 *     description: Create intelligent, personalized proposals using AI analysis of client needs and market data
 *     tags: [Universal AI Planner]
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
 *               eventDetails:
 *                 type: object
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *               customization:
 *                 type: object
 *     responses:
 *       200:
 *         description: AI proposal generated successfully
 *       401:
 *         description: Authentication required
 */
router.post(
  "/generate-proposal",
  authenticate,
  rateLimiter("ai-planner-proposal", 10, 60 * 60), // 10 requests per hour
  UniversalAIController.generateProposal
);

/**
 * @swagger
 * /ai-planner/learning-insights:
 *   get:
 *     summary: Get AI learning insights (Authenticated Users)
 *     description: Access personalized insights from AI learning model about user performance and improvement opportunities
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Learning insights retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/learning-insights",
  authenticate,
  rateLimiter("ai-planner-learning", 20, 60 * 60), // 20 requests per hour
  UniversalAIController.getLearningInsights
);

/**
 * @swagger
 * /ai-planner/train-model:
 *   post:
 *     summary: Train AI model with user data (Professional+ only)
 *     description: Train the AI model with user-specific data for improved personalization and accuracy
 *     tags: [Universal AI Planner]
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
  authenticate,
  rateLimiter("ai-planner-train", 5, 24 * 60 * 60), // 5 requests per day
  UniversalAIController.trainModel
);

/**
 * @swagger
 * /ai-planner/model-metrics:
 *   get:
 *     summary: Get AI model performance metrics (Professional+ only)
 *     description: Access detailed performance metrics and analytics for the user's AI model
 *     tags: [Universal AI Planner]
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
  authenticate,
  rateLimiter("ai-planner-metrics", 50, 60 * 60), // 50 requests per hour
  UniversalAIController.getModelMetrics
);

/**
 * @swagger
 * /ai-planner/visual-suggestions:
 *   post:
 *     summary: Generate AI visual suggestions (All Users)
 *     description: Generate intelligent visual suggestions including color palettes, mood boards, and design concepts
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *       - {}
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
 *     responses:
 *       200:
 *         description: Visual suggestions generated successfully
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  "/visual-suggestions",
  optionalAuth,
  rateLimiter("ai-planner-visual", 20, 60 * 60), // 20 requests per hour
  UniversalAIController.generateVisualSuggestions
);

/**
 * @swagger
 * /ai-planner/save-plan:
 *   post:
 *     summary: Save AI-generated plan (Authenticated Users)
 *     description: Save a generated event plan to the authenticated user's account for future access and management
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planData
 *             properties:
 *               planData:
 *                 type: object
 *                 description: The AI-generated plan data to save
 *               eventTitle:
 *                 type: string
 *                 example: Sarah & John's Wedding
 *                 description: Optional custom title for the saved event
 *     responses:
 *       200:
 *         description: Plan saved successfully
 *       401:
 *         description: Authentication required
 */
router.post(
  "/save-plan",
  authenticate,
  rateLimiter("ai-planner-save", 20, 60 * 60), // 20 requests per hour
  UniversalAIController.savePlan
);

/**
 * @swagger
 * /ai-planner/save-generated-plan:
 *   post:
 *     summary: Save a generated plan that wasn't auto-saved (Authenticated Users)
 *     description: Save a plan that was generated but not automatically saved due to authentication or other issues
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planData:
 *                 type: object
 *                 description: The generated plan data to save
 *               sessionToken:
 *                 type: string
 *                 description: Session token if plan was generated as guest
 *               eventTitle:
 *                 type: string
 *                 description: Optional custom title for the event
 *     responses:
 *       200:
 *         description: Generated plan saved successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: No plan data provided
 */
router.post(
  "/save-generated-plan",
  authenticate,
  rateLimiter("ai-planner-save-generated", 10, 60 * 60), // 10 requests per hour
  UniversalAIController.saveGeneratedPlan
);

/**
 * @swagger
 * /ai-planner/my-plans:
 *   get:
 *     summary: Get user's saved plans (Authenticated Users)
 *     description: Retrieve all AI-generated plans saved by the authenticated user
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Number of plans per page
 *     responses:
 *       200:
 *         description: User plans retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/my-plans",
  authenticate,
  rateLimiter("ai-planner-plans", 50, 60 * 60), // 50 requests per hour
  UniversalAIController.getMyPlans
);

/**
 * @swagger
 * /ai-planner/plans:
 *   get:
 *     summary: Get user's saved plans (Authenticated Users) - Alias for /my-plans
 *     description: Retrieve all AI-generated plans saved by the authenticated user with advanced filtering and sorting
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 9
 *         description: Number of plans per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created, updated, title, status]
 *           default: updated
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, refined, finalized, archived]
 *         description: Filter by plan status
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *     responses:
 *       200:
 *         description: User plans retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/plans",
  authenticate,
  rateLimiter("ai-planner-plans", 50, 60 * 60), // 50 requests per hour
  UniversalAIController.getMyPlans
);

/**
 * @swagger
 * /ai-planner/recent-plans:
 *   get:
 *     summary: Get user's recent AI plans on login (Authenticated Users)
 *     description: Retrieve recent AI-generated plans for authenticated users to continue working on them. This enables seamless continuation of work after login.
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 5
 *         description: Number of recent plans to retrieve
 *       - in: query
 *         name: includeArchived
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include archived plans
 *     responses:
 *       200:
 *         description: Recent plans retrieved successfully
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
 *                   example: Recent plans retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     plans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           planId:
 *                             type: string
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           status:
 *                             type: string
 *                           lastModified:
 *                             type: string
 *                             format: date-time
 *                           eventType:
 *                             type: string
 *                     userContext:
 *                       type: object
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         retrievedAt:
 *                           type: string
 *                           format: date-time
 *                         totalPlans:
 *                           type: number
 *                         canCreateMore:
 *                           type: boolean
 *       401:
 *         description: Authentication required
 */
router.get(
  "/recent-plans",
  authenticate,
  rateLimiter("ai-planner-recent", 30, 60 * 60), // 30 requests per hour
  UniversalAIController.getRecentPlans
);

/**
 * @swagger
 * /ai-planner/result/{id}:
 *   get:
 *     summary: Get AI plan result by ID (Session Token or Saved Plan ID)
 *     description: Retrieve a previously generated AI plan using either a session token (for guests) or a saved plan ID (for authenticated users). This enables users to continue from where they left off after creating an account or upgrading their plan.
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session token (for guests) or saved plan ID (for authenticated users)
 *         example: 3699d2c56e2741ff954c6c912...
 *     responses:
 *       200:
 *         description: Plan result retrieved successfully
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
 *                   example: Plan result retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     eventPlan:
 *                       type: object
 *                       description: Complete AI-generated event plan
 *                     userContext:
 *                       type: object
 *                       properties:
 *                         userType:
 *                           type: string
 *                           enum: [guest, user, vendor, planner, admin]
 *                         planLevel:
 *                           type: number
 *                           example: 2
 *                         availableFeatures:
 *                           type: object
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         retrievedAt:
 *                           type: string
 *                           format: date-time
 *                         originalGeneratedAt:
 *                           type: string
 *                           format: date-time
 *                         resultType:
 *                           type: string
 *                           enum: [session, saved]
 *                         canUpgrade:
 *                           type: boolean
 *       404:
 *         description: Plan result not found or expired
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Plan result not found or expired
 *                 code:
 *                   type: string
 *                   example: PLAN_NOT_FOUND
 *       429:
 *         description: Rate limit exceeded
 */
router.get(
  "/result/:id",
  optionalAuth, // Supports both authenticated and unauthenticated access
  rateLimiter("ai-planner-result", 50, 60 * 60), // 50 requests per hour
  UniversalAIController.getPlanResult
);

/**
 * @swagger
 * /ai-planner/plans/{planId}/chat:
 *   post:
 *     summary: Chat with AI about a specific plan (Authenticated Users)
 *     description: Have a conversational interaction with AI about a specific plan. Ask questions, get suggestions, or discuss modifications in a natural chat format.
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the plan to chat about
 *         example: plan_003
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's message or question about the plan
 *                 example: "What are some alternatives to the current venue that would fit our budget?"
 *               context:
 *                 type: object
 *                 description: Additional context for the conversation
 *                 properties:
 *                   conversationId:
 *                     type: string
 *                     description: ID to maintain conversation context
 *                   previousMessages:
 *                     type: array
 *                     items:
 *                       type: object
 *                     description: Previous messages in the conversation
 *     responses:
 *       200:
 *         description: AI response generated successfully
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
 *                   example: AI response generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     response:
 *                       type: string
 *                       description: AI's response to the user's message
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Follow-up suggestions or questions
 *                     planUpdates:
 *                       type: object
 *                       description: Any suggested updates to the plan
 *                     conversationId:
 *                       type: string
 *                       description: ID for continuing the conversation
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                         aiModel:
 *                           type: string
 *                         confidence:
 *                           type: number
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Plan not found or access denied
 *       400:
 *         description: Invalid message or request
 */
router.post(
  "/plans/:planId/chat",
  authenticate,
  rateLimiter("ai-planner-chat", 20, 60 * 60), // 20 requests per hour
  UniversalAIController.chatWithPlan
);

/**
 * @swagger
 * /ai-planner/refine/{planId}:
 *   post:
 *     summary: Refine existing AI plan with additional prompts (Authenticated Users)
 *     description: Refine and improve an existing AI-generated plan by providing additional prompts and requirements. This allows users to iteratively improve their plans with deeper details.
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the plan to refine
 *         example: plan_1234567890_abc123def
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refinementPrompt
 *             properties:
 *               refinementPrompt:
 *                 type: string
 *                 description: Detailed prompt describing what to refine or improve
 *                 example: "I need more vegetarian options in the catering and want to add a photo booth area"
 *               refinementType:
 *                 type: string
 *                 enum: [budget_adjustment, timeline_change, vendor_swap, requirement_update, style_change, general]
 *                 default: general
 *                 description: Type of refinement being requested
 *     responses:
 *       200:
 *         description: Plan refined successfully
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
 *                   example: Plan refined successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     refinedPlan:
 *                       type: object
 *                       description: The updated AI plan with refinements
 *                     changes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of changes made to the plan
 *                     reasoning:
 *                       type: string
 *                       description: AI explanation of why changes were made
 *                     userContext:
 *                       type: object
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         refinedAt:
 *                           type: string
 *                           format: date-time
 *                         refinementType:
 *                           type: string
 *                         changesCount:
 *                           type: number
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Plan not found or access denied
 *       400:
 *         description: Invalid refinement prompt
 */
router.post(
  "/refine/:planId",
  authenticate,
  rateLimiter("ai-planner-refine", 10, 60 * 60), // 10 requests per hour
  UniversalAIController.refinePlan
);

/**
 * @swagger
 * /ai-planner/plans/{planId}:
 *   put:
 *     summary: Update an existing AI plan (Authenticated Users)
 *     description: Update an existing AI-generated plan with new data or modifications
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the plan to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planData:
 *                 type: object
 *                 description: Updated plan data
 *               eventTitle:
 *                 type: string
 *                 description: Updated event title
 *               status:
 *                 type: string
 *                 enum: [draft, active, refined, finalized, archived]
 *                 description: Updated plan status
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Plan not found or access denied
 */
router.put(
  "/plans/:planId",
  authenticate,
  rateLimiter("ai-planner-update", 30, 60 * 60), // 30 requests per hour
  UniversalAIController.updatePlan
);

/**
 * @swagger
 * /ai-planner/plans/{planId}:
 *   delete:
 *     summary: Delete an AI plan (Authenticated Users)
 *     description: Delete an existing AI-generated plan
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the plan to delete
 *     responses:
 *       200:
 *         description: Plan deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Plan not found or access denied
 */
router.delete(
  "/plans/:planId",
  authenticate,
  rateLimiter("ai-planner-delete", 20, 60 * 60), // 20 requests per hour
  UniversalAIController.deletePlan
);

/**
 * @swagger
 * /ai-planner/guest-session:
 *   post:
 *     summary: Create guest session for non-authenticated users
 *     description: Create a guest session token that allows non-authenticated users to manage their AI plans, refine them, and continue working
 *     tags: [Universal AI Planner]
 *     responses:
 *       200:
 *         description: Guest session created successfully
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
 *                     guestSessionToken:
 *                       type: string
 *                       description: Token to use for guest session management
 *                     session:
 *                       type: object
 *                       properties:
 *                         planLevel:
 *                           type: number
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 */
router.post(
  "/guest-session",
  rateLimiter("ai-planner-guest-session", 10, 60 * 60), // 10 requests per hour
  UniversalAIController.createGuestSession
);

/**
 * @swagger
 * /ai-planner/guest-session/{sessionToken}:
 *   get:
 *     summary: Get guest session info and plans
 *     description: Retrieve guest session information and associated plans
 *     tags: [Universal AI Planner]
 *     parameters:
 *       - in: path
 *         name: sessionToken
 *         required: true
 *         schema:
 *           type: string
 *         description: Guest session token
 *     responses:
 *       200:
 *         description: Guest session retrieved successfully
 *       404:
 *         description: Guest session not found or expired
 */
router.get(
  "/guest-session/:sessionToken",
  rateLimiter("ai-planner-guest-info", 30, 60 * 60), // 30 requests per hour
  UniversalAIController.getGuestSession
);

/**
 * @swagger
 * /ai-planner/convert-guest-session:
 *   post:
 *     summary: Convert guest session to user account
 *     description: Convert guest session plans to saved plans when user registers or logs in
 *     tags: [Universal AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestSessionToken
 *             properties:
 *               guestSessionToken:
 *                 type: string
 *                 description: Guest session token to convert
 *     responses:
 *       200:
 *         description: Guest session converted successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Invalid guest session token
 */
router.post(
  "/convert-guest-session",
  authenticate,
  rateLimiter("ai-planner-convert-guest", 5, 60 * 60), // 5 requests per hour
  UniversalAIController.convertGuestSession
);

/**
 * @swagger
 * /ai-planner/health:
 *   get:
 *     summary: Comprehensive AI system health check
 *     description: Check the health and availability of the universal AI planning system including all AI models and services
 *     tags: [Universal AI Planner]
 *     responses:
 *       200:
 *         description: AI system is healthy and operational
 *       503:
 *         description: AI system is unavailable or unhealthy
 */
router.get("/health", UniversalAIController.healthCheck);

export default router;
