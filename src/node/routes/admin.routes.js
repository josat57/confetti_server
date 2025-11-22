import express from "express";
import { validateRequest } from "../middleware/validation.js";
import { authenticateAdmin, authorizeAdmin } from "../middleware/auth.js";
import {
  createAdmin,
  getAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  updateAdminStatus,
  getAdminPermissions,
  updateAdminPermissions,
  updatePermissions,
  login,
  logout,
  refreshToken,
  verifyAdmin,
  setupTwoFactor,
  verifyTwoFactor,
  getUsers,
  updateUserStatus,
  updateUserRole,
  manageContent,
  updateSystemConfig,
  moderateContent,
  getSupportTickets,
  updateTicketStatus,
  getAuditLogs,
  getAnalytics,
  getEvents,
  getVendors,
  updateVendorStatus,
  sendAnnouncement,
  getSecurityLogs,
  getFinancialReports,
} from "../controllers/admin.controller.js";

const router = express.Router();

// Public routes
router.post("/super-admin", validateRequest("createAdmin"), createAdmin);
router.post("/login", validateRequest("login"), login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);

// Protected routes
router.use(authenticateAdmin);

// Admin management routes
router.get("/verify", verifyAdmin);
router.get("/", getAdmins);
router.get("/:id", getAdminById);
router.put("/:id", validateRequest("updateAdmin"), updateAdmin);
router.delete("/:id", deleteAdmin);
router.patch("/:id/status", validateRequest("updateStatus"), updateAdminStatus);
router.get("/:id/permissions", getAdminPermissions);
router.put(
  "/:id/permissions",
  validateRequest("updatePermissions"),
  updateAdminPermissions
);

// Two-factor authentication routes
router.post("/:id/2fa/setup", authorizeAdmin(["super_admin"]), setupTwoFactor);

router.post(
  "/:id/2fa/verify",
  authorizeAdmin(["super_admin"]),
  validateRequest("verifyTwoFactor"),
  verifyTwoFactor
);

// User management routes

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users in the system
 *     description: Retrieve a complete list of all registered users. Requires admin authentication with user_management permission.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved list of users
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions (requires user_management permission)
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
router.get("/users", authorizeAdmin(["user_management"]), getUsers);

/**
 * @swagger
 * /admin/users/{userId}/status:
 *   put:
 *     summary: Update user status
 *     description: Update the status of a specific user (e.g., active, suspended, banned). Requires admin authentication with user_management permission.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the user
 *         example: 507f1f77bcf86cd799439011
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
 *                 enum: [active, suspended, banned, inactive]
 *                 example: active
 *                 description: New status for the user
 *     responses:
 *       200:
 *         description: User status successfully updated
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
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
 *         description: Forbidden - Insufficient permissions (requires user_management permission)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
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
  "/users/:userId/status",
  authorizeAdmin(["user_management"]),
  validateRequest("updateUserStatus"),
  updateUserStatus
);

/**
 * @swagger
 * /admin/users/{userId}/role:
 *   put:
 *     summary: Update user role
 *     description: Update the role of a specific user (e.g., user, vendor, admin, event-planner). Requires admin authentication with user_management permission.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the user
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, event-planner, vendor]
 *                 example: vendor
 *                 description: New role for the user
 *     responses:
 *       200:
 *         description: User role successfully updated
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
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
 *         description: Forbidden - Insufficient permissions (requires user_management permission)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
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
  "/users/:userId/role",
  authorizeAdmin(["user_management"]),
  validateRequest("updateUserRole"),
  updateUserRole
);

// Content management routes
router.post(
  "/content",
  authorizeAdmin(["content_management"]),
  validateRequest("manageContent"),
  manageContent
);

// System configuration routes
router.put(
  "/config",
  authorizeAdmin(["system_configuration"]),
  validateRequest("updateSystemConfig"),
  updateSystemConfig
);

// Moderation routes
router.put(
  "/content/:contentId/moderate",
  authorizeAdmin(["moderation"]),
  validateRequest("moderateContent"),
  moderateContent
);

// Support ticket routes
router.get("/tickets", authorizeAdmin(["support_tickets"]), getSupportTickets);

router.put(
  "/tickets/:ticketId/status",
  authorizeAdmin(["support_tickets"]),
  validateRequest("updateTicketStatus"),
  updateTicketStatus
);

// Audit log routes
router.get("/audit-logs", authorizeAdmin(["audit_logs"]), getAuditLogs);

// Analytics routes

/**
 * @swagger
 * /admin/analytics:
 *   get:
 *     summary: Get system analytics and statistics
 *     description: Retrieve comprehensive analytics including user counts, event statistics, and revenue data. Requires admin authentication with analytics permission.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved analytics data
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
 *                     analytics:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: number
 *                           example: 1250
 *                           description: Total number of registered users
 *                         activeUsers:
 *                           type: number
 *                           example: 980
 *                           description: Number of active users
 *                         totalEvents:
 *                           type: number
 *                           example: 456
 *                           description: Total number of events created
 *                         upcomingEvents:
 *                           type: number
 *                           example: 123
 *                           description: Number of upcoming events
 *                         totalRevenue:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                                 nullable: true
 *                               total:
 *                                 type: number
 *                                 example: 125000
 *                           description: Total revenue from completed payments
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions (requires analytics permission)
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
router.get("/analytics", authorizeAdmin(["analytics"]), getAnalytics);

// Event management routes

/**
 * @swagger
 * /admin/events:
 *   get:
 *     summary: List all events in the system
 *     description: Retrieve a complete list of all events with organizer details. Requires admin authentication with analytics permission.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved list of events
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
 *                     events:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Event'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions (requires analytics permission)
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
router.get("/events", authorizeAdmin(["analytics"]), getEvents);

// Vendor management routes

/**
 * @swagger
 * /admin/vendors:
 *   get:
 *     summary: List all vendors in the system
 *     description: Retrieve a complete list of all registered vendors with their details. Requires admin authentication with vendor_management permission.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved list of vendors
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
 *                     vendors:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vendor'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions (requires vendor_management permission)
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
router.get("/vendors", authorizeAdmin(["vendor_management"]), getVendors);

router.put(
  "/vendors/:vendorId/status",
  authorizeAdmin(["vendor_management"]),
  validateRequest("updateVendorStatus"),
  updateVendorStatus
);

// Communication management routes
router.post(
  "/announcements",
  authorizeAdmin(["communication_management"]),
  validateRequest("sendAnnouncement"),
  sendAnnouncement
);

// Security and compliance routes
router.get(
  "/security-logs",
  authorizeAdmin(["security_compliance"]),
  getSecurityLogs
);

// Financial oversight routes

/**
 * @swagger
 * /admin/financial-reports:
 *   get:
 *     summary: Get financial reports and revenue analytics
 *     description: Retrieve detailed financial reports including revenue breakdown by month and year. Supports optional date range filtering. Requires admin authentication with financial_oversight permission.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the report period (YYYY-MM-DD)
 *         example: 2024-01-01
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the report period (YYYY-MM-DD)
 *         example: 2024-12-31
 *     responses:
 *       200:
 *         description: Successfully retrieved financial reports
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
 *                     reports:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               year:
 *                                 type: number
 *                                 example: 2024
 *                               month:
 *                                 type: number
 *                                 example: 1
 *                           totalRevenue:
 *                             type: number
 *                             example: 45000
 *                             description: Total revenue for the period
 *                           count:
 *                             type: number
 *                             example: 23
 *                             description: Number of completed transactions
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions (requires financial_oversight permission)
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
  "/financial-reports",
  authorizeAdmin(["financial_oversight"]),
  getFinancialReports
);

export default router;
