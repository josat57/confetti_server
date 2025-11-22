import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getEventAnalytics,
  getBusinessAnalytics,
  getTaskAnalytics,
  generateCustomReport,
} from "../controllers/analytics.controller.js";

const router = express.Router();

/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: List analytics data with filtering
 *     description: Retrieve analytics data including event statistics, vendor performance metrics, and revenue reports. Supports filtering by date ranges, event types, and other parameters. Admin users can access revenue data.
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for analytics data range (ISO 8601 format)
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for analytics data range (ISO 8601 format)
 *         example: "2024-12-31T23:59:59Z"
 *       - in: query
 *         name: event
 *         schema:
 *           type: string
 *         description: Filter by specific event ID
 *         example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Filter by specific user ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [view, click, purchase, share, other]
 *         description: Filter by action type
 *         example: "view"
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [wedding, birthday, corporate, social, other]
 *         description: Filter analytics by event type
 *         example: "corporate"
 *       - in: query
 *         name: vendorCategory
 *         schema:
 *           type: string
 *           enum: [venue, catering, entertainment, photography, videography, decoration, florals, transportation, audio_visual, event_planning, security, valet_parking, rentals, cake_desserts, bar_services, lighting, invitations, favors_gifts, other]
 *         description: Filter analytics by vendor category
 *         example: "catering"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of records to return
 *         example: 100
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439020"
 *                       event:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439012"
 *                         description: Event ID
 *                       user:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                         description: User ID
 *                       action:
 *                         type: string
 *                         enum: [view, click, purchase, share, other]
 *                         example: "view"
 *                       metadata:
 *                         type: object
 *                         description: Additional analytics metadata
 *                         example: { "source": "web", "device": "desktop" }
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 250
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pages:
 *                       type: integer
 *                       example: 5
 *                     limit:
 *                       type: integer
 *                       example: 50
 *             examples:
 *               eventStatistics:
 *                 summary: Event statistics example
 *                 value:
 *                   success: true
 *                   data:
 *                     - _id: "507f1f77bcf86cd799439020"
 *                       event: "507f1f77bcf86cd799439012"
 *                       user: "507f1f77bcf86cd799439011"
 *                       action: "view"
 *                       metadata:
 *                         eventType: "corporate"
 *                         views: 150
 *                         clicks: 45
 *                       createdAt: "2024-01-15T10:30:00Z"
 *                       updatedAt: "2024-01-15T10:30:00Z"
 *                   pagination:
 *                     total: 250
 *                     page: 1
 *                     pages: 5
 *                     limit: 50
 *               vendorPerformance:
 *                 summary: Vendor performance metrics example
 *                 value:
 *                   success: true
 *                   data:
 *                     - _id: "507f1f77bcf86cd799439021"
 *                       event: "507f1f77bcf86cd799439012"
 *                       user: "507f1f77bcf86cd799439011"
 *                       action: "click"
 *                       metadata:
 *                         vendorId: "507f1f77bcf86cd799439013"
 *                         vendorCategory: "catering"
 *                         rating: 4.5
 *                         bookings: 12
 *                       createdAt: "2024-01-15T10:30:00Z"
 *                       updatedAt: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: "fail"
 *               message: "Invalid date range provided"
 *               statusCode: 400
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/events", getEventAnalytics);
router.get("/business", getBusinessAnalytics);
router.get("/tasks", getTaskAnalytics);

/**
 * @swagger
 * /analytics/{id}:
 *   get:
 *     summary: Get specific analytics record by ID
 *     description: Retrieve detailed information about a specific analytics record including event statistics, user actions, and metadata
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Analytics record ID
 *         example: "507f1f77bcf86cd799439020"
 *     responses:
 *       200:
 *         description: Analytics record retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     event:
 *                       $ref: '#/components/schemas/Event'
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     action:
 *                       type: string
 *                       enum: [view, click, purchase, share, other]
 *                       example: "purchase"
 *                     metadata:
 *                       type: object
 *                       description: Additional analytics metadata
 *                       example:
 *                         amount: 5000
 *                         currency: "USD"
 *                         paymentMethod: "credit_card"
 *                         vendorId: "507f1f77bcf86cd799439013"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *             examples:
 *               revenueRecord:
 *                 summary: Revenue analytics record
 *                 value:
 *                   success: true
 *                   data:
 *                     _id: "507f1f77bcf86cd799439020"
 *                     event:
 *                       _id: "507f1f77bcf86cd799439012"
 *                       title: "Annual Tech Conference 2024"
 *                       eventType: "corporate"
 *                     user:
 *                       _id: "507f1f77bcf86cd799439011"
 *                       email: "john.doe@example.com"
 *                       firstName: "John"
 *                       lastName: "Doe"
 *                     action: "purchase"
 *                     metadata:
 *                       amount: 5000
 *                       currency: "USD"
 *                       paymentMethod: "credit_card"
 *                       vendorId: "507f1f77bcf86cd799439013"
 *                       commission: 500
 *                     createdAt: "2024-01-15T10:30:00Z"
 *                     updatedAt: "2024-01-15T10:30:00Z"
 *       404:
 *         description: Analytics record not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: "fail"
 *               message: "Analytics not found"
 *               statusCode: 404
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Protected routes (require authentication)
router.use(protect);

/**
 * @swagger
 * /analytics:
 *   post:
 *     summary: Create new analytics record
 *     description: Create a new analytics record to track user actions, event statistics, vendor performance, or revenue data. Requires authentication.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *               - user
 *               - action
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event ID associated with this analytics record
 *                 example: "507f1f77bcf86cd799439012"
 *               user:
 *                 type: string
 *                 description: User ID associated with this analytics record
 *                 example: "507f1f77bcf86cd799439011"
 *               action:
 *                 type: string
 *                 enum: [view, click, purchase, share, other]
 *                 description: Type of action being tracked
 *                 example: "purchase"
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for the analytics record
 *                 example:
 *                   amount: 5000
 *                   currency: "USD"
 *                   vendorId: "507f1f77bcf86cd799439013"
 *                   source: "web"
 *                   device: "desktop"
 *           examples:
 *             eventView:
 *               summary: Track event view
 *               value:
 *                 event: "507f1f77bcf86cd799439012"
 *                 user: "507f1f77bcf86cd799439011"
 *                 action: "view"
 *                 metadata:
 *                   source: "web"
 *                   device: "mobile"
 *                   referrer: "google"
 *             vendorClick:
 *               summary: Track vendor click
 *               value:
 *                 event: "507f1f77bcf86cd799439012"
 *                 user: "507f1f77bcf86cd799439011"
 *                 action: "click"
 *                 metadata:
 *                   vendorId: "507f1f77bcf86cd799439013"
 *                   vendorCategory: "catering"
 *                   position: 3
 *             revenuePurchase:
 *               summary: Track revenue from purchase
 *               value:
 *                 event: "507f1f77bcf86cd799439012"
 *                 user: "507f1f77bcf86cd799439011"
 *                 action: "purchase"
 *                 metadata:
 *                   amount: 5000
 *                   currency: "USD"
 *                   paymentMethod: "credit_card"
 *                   vendorId: "507f1f77bcf86cd799439013"
 *                   commission: 500
 *                   transactionId: "txn_1234567890"
 *     responses:
 *       201:
 *         description: Analytics record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     event:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     user:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     action:
 *                       type: string
 *                       example: "purchase"
 *                     metadata:
 *                       type: object
 *                       example:
 *                         amount: 5000
 *                         currency: "USD"
 *                         vendorId: "507f1f77bcf86cd799439013"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: "fail"
 *               message: "Event and user are required fields"
 *               statusCode: 400
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: "fail"
 *               message: "Not authorized to access this route"
 *               statusCode: 401
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/reports/custom", generateCustomReport);

export default router;
