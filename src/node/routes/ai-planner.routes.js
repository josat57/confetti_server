import express from "express";
import AIEventPlannerController from "../controllers/ai-planner.controller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { protect as authenticate } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * /ai-planner/analyze:
 *   post:
 *     summary: Analyze event and generate AI-powered plan
 *     description: Generate an AI-powered event plan with vendor recommendations, budget breakdown, and timeline. Rate limited to 5 requests per hour per IP address.
 *     tags: [AI Planner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - guestCount
 *               - budget
 *               - location
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [wedding, birthday, corporate, social, other]
 *                 example: wedding
 *                 description: Type of event to plan
 *               guestCount:
 *                 type: number
 *                 minimum: 1
 *                 example: 150
 *                 description: Expected number of guests
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
 *                     description: Total budget amount
 *                   currency:
 *                     type: string
 *                     enum: [NGN, USD, EUR, GBP]
 *                     example: USD
 *                     description: Currency code
 *               location:
 *                 type: object
 *                 required:
 *                   - city
 *                   - country
 *                 properties:
 *                   city:
 *                     type: string
 *                     example: New York
 *                     description: Event city
 *                   state:
 *                     type: string
 *                     example: NY
 *                     description: Event state/province
 *                   country:
 *                     type: string
 *                     example: USA
 *                     description: Event country
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-06-15T14:00:00Z
 *                 description: Preferred event date
 *               preferences:
 *                 type: object
 *                 properties:
 *                   theme:
 *                     type: string
 *                     example: elegant
 *                     description: Event theme or style
 *                   dietary:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: [vegetarian, gluten-free]
 *                     description: Dietary requirements
 *                   specialRequests:
 *                     type: string
 *                     example: Outdoor venue with garden
 *                     description: Special requests or requirements
 *     responses:
 *       200:
 *         description: Event plan generated successfully
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
 *                   example: Event plan generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionToken:
 *                       type: string
 *                       example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
 *                       description: Unique session token to retrieve the plan (64 characters)
 *                     eventPlan:
 *                       type: object
 *                       properties:
 *                         summary:
 *                           type: string
 *                           example: A comprehensive plan for your wedding with 150 guests
 *                         recommendations:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                                 example: venue
 *                               suggestion:
 *                                 type: string
 *                                 example: Consider outdoor garden venues for an elegant atmosphere
 *                         vendors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: Elite Catering Services
 *                               category:
 *                                 type: string
 *                                 example: catering
 *                               estimatedCost:
 *                                 type: number
 *                                 example: 7500
 *                         budgetBreakdown:
 *                           type: object
 *                           properties:
 *                             venue:
 *                               type: number
 *                               example: 15000
 *                             catering:
 *                               type: number
 *                               example: 7500
 *                             decoration:
 *                               type: number
 *                               example: 5000
 *                             photography:
 *                               type: number
 *                               example: 3000
 *                             entertainment:
 *                               type: number
 *                               example: 2500
 *                             other:
 *                               type: number
 *                               example: 2000
 *                         timeline:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               task:
 *                                 type: string
 *                                 example: Book venue
 *                               daysBeforeEvent:
 *                                 type: number
 *                                 example: 180
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2024-01-16T10:30:00Z
 *                       description: Session expiration timestamp
 *                 meta:
 *                   type: object
 *                   properties:
 *                     processingTime:
 *                       type: number
 *                       example: 2345
 *                       description: Processing time in milliseconds
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded (5 requests per hour)
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
 *                   example: Rate limit exceeded. Please try again later.
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/analyze",
  rateLimiter("ai-planner", 5, 60 * 60), // 5 requests per hour
  AIEventPlannerController.analyzeEvent
);

/**
 * @swagger
 * /ai-planner/result/{sessionToken}:
 *   get:
 *     summary: Get event plan by session token
 *     description: Retrieve a previously generated event plan using the session token. Session tokens expire after a certain period.
 *     tags: [AI Planner]
 *     parameters:
 *       - in: path
 *         name: sessionToken
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 64
 *           maxLength: 64
 *         description: Unique session token (64 characters) obtained from the analyze endpoint
 *         example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
 *     responses:
 *       200:
 *         description: Event plan retrieved successfully
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
 *                     eventPlan:
 *                       type: object
 *                       properties:
 *                         summary:
 *                           type: string
 *                           example: A comprehensive plan for your wedding with 150 guests
 *                         recommendations:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                                 example: venue
 *                               suggestion:
 *                                 type: string
 *                                 example: Consider outdoor garden venues for an elegant atmosphere
 *                         vendors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: Elite Catering Services
 *                               category:
 *                                 type: string
 *                                 example: catering
 *                               estimatedCost:
 *                                 type: number
 *                                 example: 7500
 *                         budgetBreakdown:
 *                           type: object
 *                           additionalProperties:
 *                             type: number
 *                           example:
 *                             venue: 15000
 *                             catering: 7500
 *                             decoration: 5000
 *                         timeline:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               task:
 *                                 type: string
 *                                 example: Book venue
 *                               daysBeforeEvent:
 *                                 type: number
 *                                 example: 180
 *                     canUpgrade:
 *                       type: boolean
 *                       example: true
 *                       description: Whether the user can upgrade to get more detailed plan
 *       400:
 *         description: Invalid session token format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session token not found or has expired
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
 *                   example: Session token not found or has expired
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/result/:sessionToken", AIEventPlannerController.getEventPlan);

/**
 * @swagger
 * /ai-planner/save:
 *   post:
 *     summary: Save event plan to user account
 *     description: Save a generated event plan to the authenticated user's account for future access and management. Requires authentication.
 *     tags: [AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionToken
 *             properties:
 *               sessionToken:
 *                 type: string
 *                 minLength: 64
 *                 maxLength: 64
 *                 example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
 *                 description: Session token of the event plan to save
 *               eventTitle:
 *                 type: string
 *                 example: Sarah & John's Wedding
 *                 description: Optional custom title for the saved event
 *     responses:
 *       200:
 *         description: Event plan saved successfully
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
 *                   example: Event plan saved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     eventId:
 *                       type: string
 *                       example: 507f1f77bcf86cd799439012
 *                       description: ID of the saved event
 *                     message:
 *                       type: string
 *                       example: Sign up complete! Your event plan has been saved.
 *       400:
 *         description: Invalid input data or missing session token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Authentication required
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
 *                   example: Authentication required
 *       404:
 *         description: Session token not found or has expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/save", authenticate, AIEventPlannerController.saveEventPlan);

/**
 * @swagger
 * /ai-planner/full/{eventId}:
 *   get:
 *     summary: Get full event plan with vendor details
 *     description: Retrieve the complete event plan including detailed vendor information, contact details, and full recommendations. Requires authentication and the event must belong to the authenticated user.
 *     tags: [AI Planner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique event identifier
 *         example: 507f1f77bcf86cd799439012
 *     responses:
 *       200:
 *         description: Full event plan retrieved successfully
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
 *                     fullPlan:
 *                       type: object
 *                       properties:
 *                         event:
 *                           $ref: '#/components/schemas/Event'
 *                         vendors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               vendor:
 *                                 $ref: '#/components/schemas/Vendor'
 *                               category:
 *                                 type: string
 *                                 example: catering
 *                               estimatedCost:
 *                                 type: number
 *                                 example: 7500
 *                               contactDetails:
 *                                 type: object
 *                                 properties:
 *                                   email:
 *                                     type: string
 *                                     example: contact@vendor.com
 *                                   phone:
 *                                     type: string
 *                                     example: +1234567890
 *                                   website:
 *                                     type: string
 *                                     example: https://vendor.com
 *                               availability:
 *                                 type: string
 *                                 example: Available
 *                         recommendations:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                                 example: venue
 *                               title:
 *                                 type: string
 *                                 example: Venue Selection
 *                               description:
 *                                 type: string
 *                                 example: Detailed recommendations for selecting the perfect venue
 *                               tips:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                                 example: [Consider outdoor options, Check availability early]
 *                         budgetBreakdown:
 *                           type: object
 *                           additionalProperties:
 *                             type: object
 *                             properties:
 *                               allocated:
 *                                 type: number
 *                               spent:
 *                                 type: number
 *                               remaining:
 *                                 type: number
 *                         timeline:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               task:
 *                                 type: string
 *                                 example: Book venue
 *                               dueDate:
 *                                 type: string
 *                                 format: date-time
 *                                 example: 2024-01-15T00:00:00Z
 *                               status:
 *                                 type: string
 *                                 enum: [pending, in_progress, completed]
 *                                 example: pending
 *                               priority:
 *                                 type: string
 *                                 enum: [low, medium, high]
 *                                 example: high
 *                         message:
 *                           type: string
 *                           example: Full plan feature coming soon
 *       401:
 *         description: Unauthorized - Authentication required
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
 *                   example: Authentication required
 *       403:
 *         description: Forbidden - Event does not belong to the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/full/:eventId",
  authenticate,
  AIEventPlannerController.getFullEventPlan
);

/**
 * @swagger
 * /ai-planner/health:
 *   get:
 *     summary: Health check for AI services
 *     description: Check the health and availability of AI planning services including Python service connectivity and AI model status. This endpoint does not require authentication.
 *     tags: [AI Planner]
 *     responses:
 *       200:
 *         description: AI services are healthy and operational
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
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       example: healthy
 *                       description: Overall health status of AI services
 *                     pythonService:
 *                       type: object
 *                       properties:
 *                         available:
 *                           type: boolean
 *                           example: true
 *                         responseTime:
 *                           type: number
 *                           example: 45
 *                           description: Response time in milliseconds
 *                         version:
 *                           type: string
 *                           example: 1.0.0
 *                     aiModel:
 *                       type: object
 *                       properties:
 *                         loaded:
 *                           type: boolean
 *                           example: true
 *                         model:
 *                           type: string
 *                           example: gpt-4
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: 2024-01-15T10:30:00Z
 *       503:
 *         description: AI services are unavailable or unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: unhealthy
 *                     pythonService:
 *                       type: object
 *                       properties:
 *                         available:
 *                           type: boolean
 *                           example: false
 *                         error:
 *                           type: string
 *                           example: Connection timeout
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: 2024-01-15T10:30:00Z
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/health", AIEventPlannerController.healthCheck);

export default router;
