import express from "express";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import { transformEventData } from "../middleware/transformEvent.js";
import {
  uploadMedia as uploadMediaMiddleware,
  uploadMultipleMedia,
  uploadLogo as uploadImageMiddleware,
} from "../middleware/upload.js";
import {
  planEvent,
  analyzeEventFeedback,
  createEvent,
  getEvents,
  updateEvent,
  deleteEvent,
  updateEventStatus,
  addVendor,
  removeVendor,
  addGuest,
  removeGuest,
  updateBudget,
  updateSchedule,
  addTimelineItem,
  addChecklistItem,
  addDocument,
  addNote,
  getEventById,
  uploadEventImage,
  uploadEventMedia,
  uploadEventPhotos,
  getEventPhotos,
  deleteEventMedia,
} from "../controllers/event.controller.js";

const router = express.Router();

// Protect all routes
router.use(protect);

// Event routes

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create a new event
 *     description: Create a new event with details including title, description, date, location, budget, and guest count. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - eventType
 *               - startDate
 *             properties:
 *               title:
 *                 type: string
 *                 example: Annual Tech Conference 2024
 *                 description: Event title
 *               description:
 *                 type: string
 *                 example: A comprehensive technology conference featuring industry leaders
 *                 description: Detailed event description
 *               eventType:
 *                 type: string
 *                 enum: [wedding, birthday, corporate, social, other]
 *                 example: corporate
 *                 description: Type of event
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-06-15T09:00:00Z
 *                 description: Event start date and time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-06-15T18:00:00Z
 *                 description: Event end date and time
 *               location:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: object
 *                     properties:
 *                       street:
 *                         type: string
 *                         example: 123 Event Plaza
 *                       city:
 *                         type: string
 *                         example: New York
 *                       state:
 *                         type: string
 *                         example: NY
 *                       country:
 *                         type: string
 *                         example: USA
 *                       zipCode:
 *                         type: string
 *                         example: 10001
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     example: [-73.935242, 40.73061]
 *                     description: Longitude and latitude coordinates
 *               budget:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                     example: 50000
 *                     description: Budget amount
 *                   currency:
 *                     type: string
 *                     enum: [NGN, USD, EUR, GBP]
 *                     example: USD
 *                     description: Currency code
 *               guestCount:
 *                 type: number
 *                 example: 200
 *                 description: Expected number of guests
 *               category:
 *                 type: string
 *                 example: conference
 *                 description: Event category
 *               capacity:
 *                 type: number
 *                 example: 250
 *                 description: Maximum event capacity
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [technology, networking, professional]
 *     responses:
 *       201:
 *         description: Event successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
router.post(
  "/",
  transformEventData,
  validateRequest("createEvent"),
  createEvent
);

/**
 * @swagger
 * /events:
 *   get:
 *     summary: List all events
 *     description: Retrieve a list of events with optional filtering by status, event type, date range, and pagination. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, cancelled, completed]
 *         description: Filter events by status
 *         example: published
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [wedding, birthday, corporate, social, other]
 *         description: Filter events by type
 *         example: corporate
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events starting from this date
 *         example: 2024-01-01
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events ending before this date
 *         example: 2024-12-31
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of events per page
 *         example: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort field (prefix with - for descending)
 *         example: -startDate
 *     responses:
 *       200:
 *         description: List of events retrieved successfully
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
 *                     events:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Event'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 50
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         pages:
 *                           type: integer
 *                           example: 5
 *                         limit:
 *                           type: integer
 *                           example: 10
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
router.get("/", getEvents);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event details by ID
 *     description: Retrieve detailed information about a specific event including organizer, vendors, guests, and all related data. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     responses:
 *       200:
 *         description: Event details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
router.get("/:id", getEventById);

/**
 * @swagger
 * /events/{id}:
 *   put:
 *     summary: Update an event
 *     description: Update event details including title, description, date, location, budget, and status. Only the event organizer or admin can update. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated Tech Conference 2024
 *               description:
 *                 type: string
 *                 example: Updated event description
 *               eventType:
 *                 type: string
 *                 enum: [wedding, birthday, corporate, social, other]
 *                 example: corporate
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-06-15T09:00:00Z
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-06-15T18:00:00Z
 *               location:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: object
 *                     properties:
 *                       street:
 *                         type: string
 *                       city:
 *                         type: string
 *                       state:
 *                         type: string
 *                       country:
 *                         type: string
 *                       zipCode:
 *                         type: string
 *               budget:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                   currency:
 *                     type: string
 *                     enum: [NGN, USD, EUR, GBP]
 *               guestCount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [draft, published, cancelled, completed]
 *                 example: published
 *               capacity:
 *                 type: number
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions to update this event
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
router.put(
  "/:id",
  transformEventData,
  validateRequest("updateEvent"),
  updateEvent
);

/**
 * @swagger
 * /events/{id}:
 *   delete:
 *     summary: Delete an event
 *     description: Permanently delete an event. Only the event organizer or admin can delete. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Event deleted successfully
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions to delete this event
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
router.delete("/:id", deleteEvent);

/**
 * @swagger
 * /events/{id}/status:
 *   patch:
 *     summary: Update event status
 *     description: Update the status of an event (planning, confirmed, in-progress, completed, cancelled)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [planning, confirmed, in-progress, completed, cancelled]
 *                 example: confirmed
 *     responses:
 *       200:
 *         description: Event status updated successfully
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Event not found
 */
router.patch("/:id/status", updateEventStatus);

// Event-specific routes

/**
 * @swagger
 * /events/{id}/vendors:
 *   post:
 *     summary: Add a vendor to an event
 *     description: Associate a vendor with an event, specifying their role and contract details. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendorId
 *               - role
 *             properties:
 *               vendorId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439013
 *                 description: Vendor ID to add to the event
 *               role:
 *                 type: string
 *                 example: catering
 *                 description: Vendor role in the event
 *               status:
 *                 type: string
 *                 enum: [pending, accepted, rejected, completed]
 *                 example: pending
 *                 description: Vendor booking status
 *               contract:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                     example: 5000
 *                     description: Contract amount
 *                   currency:
 *                     type: string
 *                     enum: [NGN, USD, EUR, GBP]
 *                     example: USD
 *                     description: Currency code
 *                   status:
 *                     type: string
 *                     enum: [pending, paid, refunded]
 *                     example: pending
 *                     description: Payment status
 *     responses:
 *       200:
 *         description: Vendor added to event successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Event or vendor not found
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
router.post("/:id/vendors", validateRequest("addVendor"), addVendor);

/**
 * @swagger
 * /events/{id}/vendors/{vendorId}:
 *   delete:
 *     summary: Remove a vendor from an event
 *     description: Remove a vendor association from an event. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Vendor ID to remove
 *         example: 507f1f77bcf86cd799439013
 *     responses:
 *       200:
 *         description: Vendor removed from event successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Event or vendor not found
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
router.delete("/:id/vendors/:vendorId", removeVendor);

/**
 * @swagger
 * /events/{id}/guests:
 *   post:
 *     summary: Add a guest to an event
 *     description: Add a guest to the event guest list with their RSVP status. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *                 description: User ID to add as guest
 *               status:
 *                 type: string
 *                 enum: [invited, confirmed, declined]
 *                 example: invited
 *                 description: Guest RSVP status
 *               plusOne:
 *                 type: boolean
 *                 example: false
 *                 description: Whether guest can bring a plus one
 *     responses:
 *       200:
 *         description: Guest added to event successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Event or user not found
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
router.post("/:id/guests", validateRequest("addGuest"), addGuest);

/**
 * @swagger
 * /events/{id}/guests/{guestId}:
 *   delete:
 *     summary: Remove a guest from an event
 *     description: Remove a guest from the event guest list. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *       - in: path
 *         name: guestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Guest ID to remove
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Guest removed from event successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Event or guest not found
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
router.delete("/:id/guests/:guestId", removeGuest);

/**
 * @swagger
 * /events/{id}/budget:
 *   post:
 *     summary: Update event budget
 *     description: Update the budget allocation for an event. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - currency
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 75000
 *                 description: Updated budget amount
 *               currency:
 *                 type: string
 *                 enum: [NGN, USD, EUR, GBP]
 *                 example: USD
 *                 description: Currency code
 *     responses:
 *       200:
 *         description: Budget updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
router.post("/:id/budget", validateRequest("updateBudget"), updateBudget);

/**
 * @swagger
 * /events/{id}/schedule:
 *   post:
 *     summary: Update event schedule
 *     description: Update the schedule and timeline for an event. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               schedule:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     time:
 *                       type: string
 *                       format: date-time
 *                       example: 2024-06-15T09:00:00Z
 *                       description: Schedule item time
 *                     activity:
 *                       type: string
 *                       example: Registration and Welcome
 *                       description: Activity description
 *                     duration:
 *                       type: number
 *                       example: 60
 *                       description: Duration in minutes
 *                     location:
 *                       type: string
 *                       example: Main Hall
 *                       description: Activity location
 *     responses:
 *       200:
 *         description: Schedule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
router.post("/:id/schedule", validateRequest("updateSchedule"), updateSchedule);

// Timeline and checklist routes

/**
 * @swagger
 * /events/{id}/timeline:
 *   post:
 *     summary: Add a timeline item to an event
 *     description: Add a new item to the event timeline for tracking milestones and important dates. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - date
 *             properties:
 *               title:
 *                 type: string
 *                 example: Venue Booking Deadline
 *                 description: Timeline item title
 *               description:
 *                 type: string
 *                 example: Final date to confirm venue booking
 *                 description: Detailed description of the timeline item
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-05-01T23:59:59Z
 *                 description: Timeline item date
 *               status:
 *                 type: string
 *                 enum: [pending, completed, overdue]
 *                 example: pending
 *                 description: Timeline item status
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 example: high
 *                 description: Priority level
 *     responses:
 *       200:
 *         description: Timeline item added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
router.post(
  "/:id/timeline",
  validateRequest("addTimelineItem"),
  addTimelineItem
);

/**
 * @swagger
 * /events/{id}/checklist:
 *   post:
 *     summary: Add a checklist item to an event
 *     description: Add a new task to the event checklist for tracking to-do items. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - task
 *             properties:
 *               task:
 *                 type: string
 *                 example: Send invitations to guests
 *                 description: Checklist task description
 *               completed:
 *                 type: boolean
 *                 example: false
 *                 description: Task completion status
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-05-15T23:59:59Z
 *                 description: Task due date
 *               assignedTo:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *                 description: User ID of person assigned to the task
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 example: medium
 *                 description: Task priority level
 *     responses:
 *       200:
 *         description: Checklist item added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
router.post(
  "/:id/checklist",
  validateRequest("addChecklistItem"),
  addChecklistItem
);

// Document and note routes

/**
 * @swagger
 * /events/{id}/documents:
 *   post:
 *     summary: Add a document to an event
 *     description: Upload and attach a document to an event (contracts, permits, etc.). Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - url
 *             properties:
 *               title:
 *                 type: string
 *                 example: Venue Contract
 *                 description: Document title
 *               description:
 *                 type: string
 *                 example: Signed contract with venue provider
 *                 description: Document description
 *               url:
 *                 type: string
 *                 example: https://storage.example.com/documents/venue-contract.pdf
 *                 description: Document URL or file path
 *               type:
 *                 type: string
 *                 example: contract
 *                 description: Document type or category
 *               fileSize:
 *                 type: number
 *                 example: 2048576
 *                 description: File size in bytes
 *               mimeType:
 *                 type: string
 *                 example: application/pdf
 *                 description: MIME type of the document
 *     responses:
 *       200:
 *         description: Document added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
router.post("/:id/documents", validateRequest("addDocument"), addDocument);

/**
 * @swagger
 * /events/{id}/notes:
 *   post:
 *     summary: Add a note to an event
 *     description: Add a text note or comment to an event for internal tracking and communication. Requires authentication.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 507f1f77bcf86cd799439012
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: Remember to confirm catering menu by next week
 *                 description: Note content
 *               title:
 *                 type: string
 *                 example: Catering Reminder
 *                 description: Optional note title
 *               category:
 *                 type: string
 *                 example: reminder
 *                 description: Note category or type
 *               isPrivate:
 *                 type: boolean
 *                 example: false
 *                 description: Whether the note is private to the organizer
 *     responses:
 *       200:
 *         description: Note added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
router.post("/:id/notes", validateRequest("addNote"), addNote);

// New routes for AI-powered features
router.post("/plan", protect, validateRequest("planEvent"), planEvent);
router.post(
  "/analyze-feedback",
  protect,
  validateRequest("analyzeEventFeedback"),
  analyzeEventFeedback
);

// Media upload routes
router.post("/:id/image", uploadImageMiddleware, uploadEventImage);
router.post("/:id/media", uploadMediaMiddleware, uploadEventMedia);
router.get("/:id/photos", getEventPhotos);
router.post("/:id/photos", uploadMultipleMedia, uploadEventPhotos);
router.delete("/:id/media/:mediaId", deleteEventMedia);

export default router;
