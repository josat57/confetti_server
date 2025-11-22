import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  updateLeadStatus,
  addNote,
  assignLead,
  setFollowUp,
  markAsWon,
  markAsLost,
  deleteLead,
  getLeadStats,
  getFollowUpLeads,
} from "../controllers/lead.controller.js";

const router = express.Router();

// All lead routes require authentication
router.use(protect);

/**
 * @swagger
 * /vendors/leads/stats:
 *   get:
 *     summary: Get lead statistics
 *     description: Get comprehensive lead statistics including conversion rates
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       404:
 *         description: Vendor profile not found
 */
router.get("/stats", getLeadStats);

/**
 * @swagger
 * /vendors/leads/followup:
 *   get:
 *     summary: Get leads needing follow-up
 *     description: Get all leads that need follow-up today or are overdue
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Follow-up leads retrieved successfully
 *       404:
 *         description: Vendor profile not found
 */
router.get("/followup", getFollowUpLeads);

/**
 * @swagger
 * /vendors/leads:
 *   get:
 *     summary: Get all leads
 *     description: Get list of all leads with filtering and pagination
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, contacted, quoted, negotiating, won, lost]
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [website, referral, social, direct, other]
 *         description: Filter by source
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *         description: Filter by assigned user ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in customer name, email, or event type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
 *       404:
 *         description: Vendor profile not found
 */
router.get("/", getLeads);

/**
 * @swagger
 * /vendors/leads:
 *   post:
 *     summary: Create lead
 *     description: Create a new lead from customer inquiry
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer
 *               - eventDetails
 *             properties:
 *               customer:
 *                 type: object
 *                 required:
 *                   - name
 *                   - email
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   phone:
 *                     type: string
 *                   company:
 *                     type: string
 *               eventDetails:
 *                 type: object
 *                 required:
 *                   - type
 *                 properties:
 *                   type:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date
 *                   location:
 *                     type: string
 *                   venue:
 *                     type: string
 *                   guestCount:
 *                     type: integer
 *                   budget:
 *                     type: number
 *                   description:
 *                     type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *               source:
 *                 type: string
 *                 enum: [website, referral, social, direct, other]
 *                 default: website
 *               estimatedValue:
 *                 type: number
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               initialNote:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lead created successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Vendor profile not found
 */
router.post("/", createLead);

/**
 * @swagger
 * /vendors/leads/{id}:
 *   get:
 *     summary: Get single lead
 *     description: Get detailed information about a specific lead
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *     responses:
 *       200:
 *         description: Lead retrieved successfully
 *       404:
 *         description: Lead not found
 */
router.get("/:id", getLead);

/**
 * @swagger
 * /vendors/leads/{id}:
 *   put:
 *     summary: Update lead
 *     description: Update lead information
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer:
 *                 type: object
 *               eventDetails:
 *                 type: object
 *               priority:
 *                 type: string
 *               estimatedValue:
 *                 type: number
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Lead updated successfully
 *       404:
 *         description: Lead not found
 */
router.put("/:id", updateLead);

/**
 * @swagger
 * /vendors/leads/{id}/status:
 *   put:
 *     summary: Update lead status
 *     description: Update the status of a lead
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
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
 *                 enum: [new, contacted, quoted, negotiating, won, lost]
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Status is required
 *       404:
 *         description: Lead not found
 */
router.put("/:id/status", updateLeadStatus);

/**
 * @swagger
 * /vendors/leads/{id}/notes:
 *   post:
 *     summary: Add note to lead
 *     description: Add a note or comment to a lead
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *               isPrivate:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Note added successfully
 *       400:
 *         description: Note text is required
 *       404:
 *         description: Lead not found
 */
router.post("/:id/notes", addNote);

/**
 * @swagger
 * /vendors/leads/{id}/assign:
 *   put:
 *     summary: Assign lead
 *     description: Assign a lead to a team member
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
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
 *     responses:
 *       200:
 *         description: Lead assigned successfully
 *       400:
 *         description: User ID is required
 *       404:
 *         description: Lead not found
 */
router.put("/:id/assign", assignLead);

/**
 * @swagger
 * /vendors/leads/{id}/followup:
 *   put:
 *     summary: Set follow-up date
 *     description: Set or update follow-up date for a lead
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Follow-up date set successfully
 *       400:
 *         description: Date is required
 *       404:
 *         description: Lead not found
 */
router.put("/:id/followup", setFollowUp);

/**
 * @swagger
 * /vendors/leads/{id}/won:
 *   post:
 *     summary: Mark lead as won
 *     description: Mark a lead as won and optionally link to booking
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bookingId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lead marked as won
 *       404:
 *         description: Lead not found
 */
router.post("/:id/won", markAsWon);

/**
 * @swagger
 * /vendors/leads/{id}/lost:
 *   post:
 *     summary: Mark lead as lost
 *     description: Mark a lead as lost with a reason
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lead marked as lost
 *       400:
 *         description: Reason is required
 *       404:
 *         description: Lead not found
 */
router.post("/:id/lost", markAsLost);

/**
 * @swagger
 * /vendors/leads/{id}:
 *   delete:
 *     summary: Delete lead
 *     description: Permanently delete a lead
 *     tags: [Vendor Dashboard - Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *     responses:
 *       200:
 *         description: Lead deleted successfully
 *       404:
 *         description: Lead not found
 */
router.delete("/:id", deleteLead);

export default router;
