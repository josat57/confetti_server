import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getCalendarData,
  getEventsInRange,
} from "../controllers/calendar.controller.js";

const router = express.Router();

// All calendar routes require authentication
router.use(protect);

/**
 * @swagger
 * /vendors/calendar:
 *   get:
 *     summary: Get calendar view
 *     description: Get vendor's calendar with availability and bookings for a specified period
 *     tags: [Vendor Dashboard - Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date of the period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date of the period
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [available, booked, blocked]
 *         description: Filter by status
 *       - in: query
 *         name: view
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: month
 *         description: Calendar view type
 *     responses:
 *       200:
 *         description: Calendar data retrieved successfully
 *       404:
 *         description: Vendor profile not found
 */
router.get("/", getCalendarData);

/**
 * @swagger
 * /vendors/calendar/availability:
 *   get:
 *     summary: Check availability
 *     description: Check if vendor is available on specific dates and times
 *     tags: [Vendor Dashboard - Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dates
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated dates to check (YYYY-MM-DD)
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *         description: Start time (HH:MM)
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *         description: End time (HH:MM)
 *     responses:
 *       200:
 *         description: Availability check completed
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Vendor profile not found
 */
router.get("/events", getEventsInRange);

/**
 * @swagger
 * /vendors/calendar/bookings:
 *   get:
 *     summary: Get upcoming bookings
 *     description: Get vendor's upcoming bookings sorted by date
 *     tags: [Vendor Dashboard - Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of bookings to return
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by booking status
 *     responses:
 *       200:
 *         description: Upcoming bookings retrieved successfully
 *       404:
 *         description: Vendor profile not found
 */
/**
 * @swagger
 * /vendors/calendar/block:
 *   post:
 *     summary: Block dates
 *     description: Block one or more dates to prevent bookings
 *     tags: [Vendor Dashboard - Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dates
 *             properties:
 *               dates:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: date
 *                 description: Array of dates to block
 *               reason:
 *                 type: string
 *                 description: Reason for blocking
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *               isRecurring:
 *                 type: boolean
 *                 description: Whether this is a recurring block
 *               recurringPattern:
 *                 type: object
 *                 properties:
 *                   frequency:
 *                     type: string
 *                     enum: [daily, weekly, monthly]
 *                   interval:
 *                     type: integer
 *                   daysOfWeek:
 *                     type: array
 *                     items:
 *                       type: integer
 *                   endDate:
 *                     type: string
 *                     format: date
 *     responses:
 *       200:
 *         description: Dates blocked successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Vendor profile not found
 */
/**
 * @swagger
 * /vendors/calendar/unblock:
 *   post:
 *     summary: Bulk unblock dates
 *     description: Unblock multiple dates at once
 *     tags: [Vendor Dashboard - Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dates
 *             properties:
 *               dates:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: date
 *     responses:
 *       200:
 *         description: Dates unblocked successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Vendor profile not found
 */
/**
 * @swagger
 * /vendors/calendar/block/{id}:
 *   delete:
 *     summary: Unblock a specific date
 *     description: Remove block from a specific date by availability ID
 *     tags: [Vendor Dashboard - Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Availability record ID
 *     responses:
 *       200:
 *         description: Date unblocked successfully
 *       400:
 *         description: Cannot unblock booked date
 *       404:
 *         description: Availability record not found
 */
/**
 * @swagger
 * /vendors/calendar/hours:
 *   put:
 *     summary: Update working hours
 *     description: Update vendor's business/working hours
 *     tags: [Vendor Dashboard - Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessHours
 *             properties:
 *               businessHours:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     day:
 *                       type: string
 *                       enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *                     open:
 *                       type: string
 *                       description: Opening time (HH:MM)
 *                     close:
 *                       type: string
 *                       description: Closing time (HH:MM)
 *                     closed:
 *                       type: boolean
 *                       description: Whether closed on this day
 *     responses:
 *       200:
 *         description: Working hours updated successfully
 *       400:
 *         description: Invalid business hours format
 *       404:
 *         description: Vendor profile not found
 */
/**
 * @swagger
 * /vendors/calendar/timeslots:
 *   post:
 *     summary: Set time slots for a date
 *     description: Define specific time slots for a particular date
 *     tags: [Vendor Dashboard - Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - timeSlots
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               timeSlots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     startTime:
 *                       type: string
 *                       description: Start time (HH:MM)
 *                     endTime:
 *                       type: string
 *                       description: End time (HH:MM)
 *                     isAvailable:
 *                       type: boolean
 *                       default: true
 *     responses:
 *       200:
 *         description: Time slots updated successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Vendor profile not found
 */
export default router;
