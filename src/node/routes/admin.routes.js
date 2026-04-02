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
  getCurrentAdminPermissions,
  getAdminRoles,
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
  getContent,
  getContentStats,
  getContentCategories,
  manageContent,
  moderateContent,
  getSupportTickets,
  updateTicketStatus,
  getAuditLogs,
  getAnalytics,
  getReports,
  getReportsStats,
  getEvents,
  getVendors,
  updateVendorStatus,
  getAnnouncements,
  getAnnouncementStatistics,
  sendAnnouncement,
  getSecurityLogs,
  getSecurityMetrics,
  getBlockedIPs,
  performSecurityAudit,
  getFinancialReports,
  getDashboardMetrics,
  getUserById,
  getUserActivityLog,
  deleteUser,
  updateUserInfo,
  exportUsers,
  getVendorById,
  getVerificationQueue,
  approveVendor,
  rejectVendor,
  getVendorPerformance,
  suspendVendor,
  activateVendor,
  flagVendor,
  updateVendorCategory,
  getVendorStatistics,
  exportVendors,
  getFlaggedContent,
  getFlaggedContentById,
  approveFlaggedContent,
  removeFlaggedContent,
  banUserFromFlaggedContent,
  sendWarningToUser,
  getModerationHistory,
  getModerationStatistics,
  bulkModerationAction,
  updateFlaggedContentPriority,
  assignFlaggedContent,
  exportFlaggedContent,
  getSubscriptions,
  getSubscriptionById,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  issueRefund,
  getFailedPayments,
  retryPayment,
  getSubscriptionStatistics,
  exportSubscriptions,
  getRevenueReports,
  getTransactions,
  getTransactionById,
  refundTransaction,
  markTransactionAsDisputed,
  resolveTransactionDispute,
  getPaymentAnalytics,
  exportTransactions,
  reconcilePayments,
  getTransactionTrends,
  getDisputedTransactions,
  getTicketById,
  assignTicket,
  respondToTicket,
  closeTicket,
  escalateTicket,
  updateTicketPriority,
  addTicketInternalNote,
  getTicketStatistics,
  getCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
  useCannedResponse,
  exportTickets,
  getUserAnalytics,
  getEventAnalytics,
  getFinancialAnalytics,
  getEngagementAnalytics,
  generateCustomReport,
  getSystemConfigs,
  getSystemConfigByKey,
  createSystemConfig,
  updateSystemConfig,
  deleteSystemConfig,
  getFeatureFlags,
  getFeatureFlagByKey,
  createFeatureFlag,
  updateFeatureFlag,
  toggleFeatureFlag,
  deleteFeatureFlag,
  getEmailTemplates,
  getEmailTemplateByKey,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
  getSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getPaymentGatewayConfig,
  updatePaymentGatewayConfig,
  testPaymentGatewayConnection,
  getSettings,
  getSecuritySettings,
  updateSecuritySetting,
  getNotifications,
  getNotificationById,
  sendNotification,
  sendBulkNotification,
  retryFailedNotification,
  deleteNotification,
  getNotificationStatistics,
  getNotificationTemplates,
  getNotificationTemplateByKey,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  previewNotificationTemplate,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getPushTokens,
  deletePushToken,
  getEnhancedAuditLogs,
  getAuditLogById,
  getAuditStatistics,
  exportAuditLogs,
  getComplianceReports,
  getComplianceReportById,
  generateComplianceReport,
  deleteComplianceReport,
  getDataRetentionPolicies,
  getDataRetentionPolicyById,
  createDataRetentionPolicy,
  updateDataRetentionPolicy,
  deleteDataRetentionPolicy,
  applyDataRetentionPolicy,
  getGDPRRequests,
  getGDPRRequestById,
  assignGDPRRequest,
  verifyGDPRRequest,
  processGDPRRequest,
  rejectGDPRRequest,
  addGDPRRequestNote,
  getGDPRStatistics,
  performGlobalSearch,
  performAdvancedSearch,
  getSavedSearches,
  getSavedSearchById,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  executeSavedSearch,
  getSearchHistory,
  clearSearchHistory,
  getSearchAnalytics,
  bulkUpdateUserStatus,
  bulkDeleteUsers,
  bulkExportUsers,
  bulkAssignRole,
  bulkApproveVendors,
  bulkRejectVendors,
  bulkSuspendVendors,
  bulkUpdateVendorCategory,
  bulkApproveContent,
  bulkRemoveContent,
  bulkDismissContent,
  bulkSendNotifications,
  bulkDeleteNotifications,
  bulkAssignTickets,
  bulkCloseTickets,
  bulkUpdateTicketPriority,
  getConnectedAdmins,
  getConnectionStats,
  getRoomMembers,
  checkAdminOnlineStatus,
  broadcastDashboardUpdate,
  broadcastNotificationToAdmin,
  broadcastSystemAlert,
  getRecentActivities,
  broadcastToRoom,
  getReportTemplates,
  getReportTemplateById,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  getScheduledReports,
  getScheduledReportById,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  toggleScheduledReport,
  getGeneratedReports,
  getGeneratedReportById,
  generateReport,
  deleteGeneratedReport,
  downloadReport,
  getSystemMetrics,
  getCurrentSystemMetrics,
  getMetricStatistics,
  getErrorLogs,
  getErrorLogById,
  resolveError,
  getErrorStatistics,
  getSystemAlerts,
  getSystemAlertById,
  acknowledgeAlert,
  resolveSystemAlert,
  getAlertStatistics,
  getSystemHealth,
} from "../controllers/admin.controller.js";

const router = express.Router();

// Public routes
router.post("/super-admin", validateRequest("createAdmin"), createAdmin);
router.post("/login", validateRequest("login"), login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);

// Protected routes
router.use(authenticateAdmin);

// Dashboard routes
router.get("/dashboard/metrics", getDashboardMetrics);
router.get("/metrics", getDashboardMetrics);

// Admin management routes (non-parameterized)
router.get("/verify", verifyAdmin);
router.get("/settings", getSettings);
router.get("/stats", getDashboardMetrics);
router.get("/auth/permissions", getCurrentAdminPermissions);
router.get("/auth/roles", getAdminRoles);
router.get("/", getAdmins);

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
router.get("/users/export", authorizeAdmin(["user_management"]), exportUsers);
router.get("/users/:userId", authorizeAdmin(["user_management"]), getUserById);
router.get(
  "/users/:userId/activity",
  authorizeAdmin(["user_management"]),
  getUserActivityLog
);
router.put(
  "/users/:userId",
  authorizeAdmin(["user_management"]),
  validateRequest("updateUser"),
  updateUserInfo
);
router.delete(
  "/users/:userId",
  authorizeAdmin(["user_management"]),
  deleteUser
);

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
router.get(
  "/content/stats",
  authorizeAdmin(["content_management"]),
  getContentStats
);
router.get(
  "/content/categories",
  authorizeAdmin(["content_management"]),
  getContentCategories
);
router.get("/content", authorizeAdmin(["content_management"]), getContent);
router.post(
  "/content",
  authorizeAdmin(["content_management"]),
  validateRequest("manageContent"),
  manageContent
);

// System configuration routes (Legacy - replaced by Phase 10 routes)
// router.put(
//   "/config",
//   authorizeAdmin(["system_configuration"]),
//   validateRequest("updateSystemConfig"),
//   updateSystemConfig
// );

// Moderation routes (Legacy)
router.put(
  "/content/:contentId/moderate",
  authorizeAdmin(["moderation"]),
  validateRequest("moderateContent"),
  moderateContent
);

// Content Moderation routes (New System)
router.get(
  "/moderation/flagged",
  authorizeAdmin(["moderation"]),
  getFlaggedContent
);
router.get(
  "/moderation/flagged/export",
  authorizeAdmin(["moderation"]),
  exportFlaggedContent
);
router.get(
  "/moderation/statistics",
  authorizeAdmin(["moderation"]),
  getModerationStatistics
);
router.get(
  "/moderation/flagged/:flaggedContentId",
  authorizeAdmin(["moderation"]),
  getFlaggedContentById
);
router.post(
  "/moderation/flagged/:flaggedContentId/approve",
  authorizeAdmin(["moderation"]),
  approveFlaggedContent
);
router.post(
  "/moderation/flagged/:flaggedContentId/remove",
  authorizeAdmin(["moderation"]),
  validateRequest("removeFlaggedContent"),
  removeFlaggedContent
);
router.post(
  "/moderation/flagged/:flaggedContentId/ban-user",
  authorizeAdmin(["moderation"]),
  validateRequest("banUserFromFlaggedContent"),
  banUserFromFlaggedContent
);
router.post(
  "/moderation/flagged/:flaggedContentId/warn",
  authorizeAdmin(["moderation"]),
  validateRequest("sendWarningToUser"),
  sendWarningToUser
);
router.post(
  "/moderation/flagged/:flaggedContentId/assign",
  authorizeAdmin(["moderation"]),
  assignFlaggedContent
);
router.put(
  "/moderation/flagged/:flaggedContentId/priority",
  authorizeAdmin(["moderation"]),
  validateRequest("updateFlaggedContentPriority"),
  updateFlaggedContentPriority
);
router.post(
  "/moderation/bulk-action",
  authorizeAdmin(["moderation"]),
  validateRequest("bulkModerationAction"),
  bulkModerationAction
);
router.get(
  "/moderation/history/:userId",
  authorizeAdmin(["moderation"]),
  getModerationHistory
);

// Subscription & Billing routes
router.get(
  "/subscriptions",
  authorizeAdmin(["financial_oversight"]),
  getSubscriptions
);
router.get(
  "/subscriptions/export",
  authorizeAdmin(["financial_oversight"]),
  exportSubscriptions
);
router.get(
  "/subscriptions/statistics",
  authorizeAdmin(["financial_oversight"]),
  getSubscriptionStatistics
);
router.get(
  "/subscriptions/:subscriptionId",
  authorizeAdmin(["financial_oversight"]),
  getSubscriptionById
);
router.post(
  "/subscriptions/:subscriptionId/upgrade",
  authorizeAdmin(["financial_oversight"]),
  validateRequest("upgradeSubscription"),
  upgradeSubscription
);
router.post(
  "/subscriptions/:subscriptionId/downgrade",
  authorizeAdmin(["financial_oversight"]),
  validateRequest("downgradeSubscription"),
  downgradeSubscription
);
router.post(
  "/subscriptions/:subscriptionId/cancel",
  authorizeAdmin(["financial_oversight"]),
  cancelSubscription
);
router.get(
  "/payments/failed",
  authorizeAdmin(["financial_oversight"]),
  getFailedPayments
);
router.post(
  "/payments/:paymentId/refund",
  authorizeAdmin(["financial_oversight"]),
  validateRequest("issueRefund"),
  issueRefund
);
router.post(
  "/payments/:paymentId/retry",
  authorizeAdmin(["financial_oversight"]),
  retryPayment
);
router.get(
  "/revenue/reports",
  authorizeAdmin(["financial_oversight"]),
  getRevenueReports
);

// Transaction Management routes
router.get(
  "/transactions",
  authorizeAdmin(["financial_oversight"]),
  getTransactions
);
router.get(
  "/transactions/export",
  authorizeAdmin(["financial_oversight"]),
  exportTransactions
);
router.get(
  "/transactions/analytics",
  authorizeAdmin(["financial_oversight"]),
  getPaymentAnalytics
);
router.get(
  "/transactions/trends",
  authorizeAdmin(["financial_oversight"]),
  getTransactionTrends
);
router.get(
  "/transactions/disputed",
  authorizeAdmin(["financial_oversight"]),
  getDisputedTransactions
);
router.get(
  "/transactions/:transactionId",
  authorizeAdmin(["financial_oversight"]),
  getTransactionById
);
router.post(
  "/transactions/:transactionId/refund",
  authorizeAdmin(["financial_oversight"]),
  validateRequest("refundTransaction"),
  refundTransaction
);
router.post(
  "/transactions/:transactionId/dispute",
  authorizeAdmin(["financial_oversight"]),
  validateRequest("markTransactionAsDisputed"),
  markTransactionAsDisputed
);
router.post(
  "/transactions/:transactionId/resolve-dispute",
  authorizeAdmin(["financial_oversight"]),
  validateRequest("resolveTransactionDispute"),
  resolveTransactionDispute
);
router.get(
  "/payments/reconcile/:paymentMethod",
  authorizeAdmin(["financial_oversight"]),
  reconcilePayments
);

// Support ticket routes (Enhanced)
router.get("/tickets", authorizeAdmin(["support_tickets"]), getSupportTickets);
router.get(
  "/tickets/export",
  authorizeAdmin(["support_tickets"]),
  exportTickets
);
router.get(
  "/tickets/statistics",
  authorizeAdmin(["support_tickets"]),
  getTicketStatistics
);
router.get(
  "/tickets/:ticketId",
  authorizeAdmin(["support_tickets"]),
  getTicketById
);
router.post(
  "/tickets/:ticketId/assign",
  authorizeAdmin(["support_tickets"]),
  validateRequest("assignTicket"),
  assignTicket
);
router.post(
  "/tickets/:ticketId/respond",
  authorizeAdmin(["support_tickets"]),
  validateRequest("respondToTicket"),
  respondToTicket
);
router.post(
  "/tickets/:ticketId/close",
  authorizeAdmin(["support_tickets"]),
  validateRequest("closeTicket"),
  closeTicket
);
router.post(
  "/tickets/:ticketId/escalate",
  authorizeAdmin(["support_tickets"]),
  validateRequest("escalateTicket"),
  escalateTicket
);
router.put(
  "/tickets/:ticketId/priority",
  authorizeAdmin(["support_tickets"]),
  validateRequest("updateTicketPriority"),
  updateTicketPriority
);
router.post(
  "/tickets/:ticketId/notes",
  authorizeAdmin(["support_tickets"]),
  validateRequest("addTicketInternalNote"),
  addTicketInternalNote
);
router.put(
  "/tickets/:ticketId/status",
  authorizeAdmin(["support_tickets"]),
  validateRequest("updateTicketStatus"),
  updateTicketStatus
);

// Canned responses routes
router.get(
  "/canned-responses",
  authorizeAdmin(["support_tickets"]),
  getCannedResponses
);
router.post(
  "/canned-responses",
  authorizeAdmin(["support_tickets"]),
  validateRequest("createCannedResponse"),
  createCannedResponse
);
router.put(
  "/canned-responses/:responseId",
  authorizeAdmin(["support_tickets"]),
  validateRequest("updateCannedResponse"),
  updateCannedResponse
);
router.delete(
  "/canned-responses/:responseId",
  authorizeAdmin(["support_tickets"]),
  deleteCannedResponse
);
router.post(
  "/canned-responses/:responseId/use",
  authorizeAdmin(["support_tickets"]),
  useCannedResponse
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
router.get("/reports/stats", authorizeAdmin(["analytics"]), getReportsStats);
router.get("/reports", authorizeAdmin(["analytics"]), getReports);

// Enhanced Analytics routes
router.get("/analytics/users", authorizeAdmin(["analytics"]), getUserAnalytics);
router.get(
  "/analytics/events",
  authorizeAdmin(["analytics"]),
  getEventAnalytics
);
router.get(
  "/analytics/financial",
  authorizeAdmin(["analytics"]),
  getFinancialAnalytics
);
router.get(
  "/analytics/engagement",
  authorizeAdmin(["analytics"]),
  getEngagementAnalytics
);
router.post(
  "/analytics/custom-report",
  authorizeAdmin(["analytics"]),
  validateRequest("generateCustomReport"),
  generateCustomReport
);

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
router.get(
  "/vendors/export",
  authorizeAdmin(["vendor_management"]),
  exportVendors
);
router.get(
  "/vendors/statistics",
  authorizeAdmin(["vendor_management"]),
  getVendorStatistics
);
router.get(
  "/vendors/verifications",
  authorizeAdmin(["vendor_management"]),
  getVerificationQueue
);
router.get(
  "/vendors/:vendorId",
  authorizeAdmin(["vendor_management"]),
  getVendorById
);
router.get(
  "/vendors/:vendorId/performance",
  authorizeAdmin(["vendor_management"]),
  getVendorPerformance
);
router.post(
  "/vendors/:vendorId/approve",
  authorizeAdmin(["vendor_management"]),
  approveVendor
);
router.post(
  "/vendors/:vendorId/reject",
  authorizeAdmin(["vendor_management"]),
  validateRequest("rejectVendor"),
  rejectVendor
);
router.post(
  "/vendors/:vendorId/suspend",
  authorizeAdmin(["vendor_management"]),
  validateRequest("suspendVendor"),
  suspendVendor
);
router.post(
  "/vendors/:vendorId/activate",
  authorizeAdmin(["vendor_management"]),
  activateVendor
);
router.post(
  "/vendors/:vendorId/flag",
  authorizeAdmin(["vendor_management"]),
  validateRequest("flagVendor"),
  flagVendor
);
router.put(
  "/vendors/:vendorId/category",
  authorizeAdmin(["vendor_management"]),
  validateRequest("updateVendorCategory"),
  updateVendorCategory
);
router.put(
  "/vendors/:vendorId/status",
  authorizeAdmin(["vendor_management"]),
  validateRequest("updateVendorStatus"),
  updateVendorStatus
);

// Communication management routes
router.get(
  "/announcements/statistics",
  authorizeAdmin(["communication_management"]),
  getAnnouncementStatistics
);
router.get(
  "/announcements",
  authorizeAdmin(["communication_management"]),
  getAnnouncements
);
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
router.get(
  "/security/logs",
  authorizeAdmin(["security_compliance"]),
  getSecurityLogs
);
router.get(
  "/security/metrics",
  authorizeAdmin(["security_compliance"]),
  getSecurityMetrics
);
router.get(
  "/security/blocked-ips",
  authorizeAdmin(["security_compliance"]),
  getBlockedIPs
);
router.post(
  "/security/audit",
  authorizeAdmin(["security_compliance"]),
  performSecurityAudit
);
router.get(
  "/security/alerts",
  authorizeAdmin(["system_monitoring"]),
  getSystemAlerts
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

// ==================== Phase 10: System Configuration ====================

// System Configuration routes
router.get(
  "/system-config",
  authorizeAdmin(["system_config"]),
  getSystemConfigs
);
router.get(
  "/system-config/:key",
  authorizeAdmin(["system_config"]),
  getSystemConfigByKey
);
router.post(
  "/system-config",
  authorizeAdmin(["system_config"]),
  createSystemConfig
);
router.put(
  "/system-config/:key",
  authorizeAdmin(["system_config"]),
  updateSystemConfig
);
router.delete(
  "/system-config/:key",
  authorizeAdmin(["system_config"]),
  deleteSystemConfig
);

// Feature Flags routes
router.get(
  "/feature-flags",
  authorizeAdmin(["system_config"]),
  getFeatureFlags
);
router.get(
  "/feature-flags/:key",
  authorizeAdmin(["system_config"]),
  getFeatureFlagByKey
);
router.post(
  "/feature-flags",
  authorizeAdmin(["system_config"]),
  createFeatureFlag
);
router.put(
  "/feature-flags/:key",
  authorizeAdmin(["system_config"]),
  updateFeatureFlag
);
router.post(
  "/feature-flags/:key/toggle",
  authorizeAdmin(["system_config"]),
  toggleFeatureFlag
);
router.delete(
  "/feature-flags/:key",
  authorizeAdmin(["system_config"]),
  deleteFeatureFlag
);

// Email Templates routes
router.get(
  "/email-templates",
  authorizeAdmin(["system_config"]),
  getEmailTemplates
);
router.get(
  "/email-templates/:key",
  authorizeAdmin(["system_config"]),
  getEmailTemplateByKey
);
router.post(
  "/email-templates",
  authorizeAdmin(["system_config"]),
  createEmailTemplate
);
router.put(
  "/email-templates/:key",
  authorizeAdmin(["system_config"]),
  updateEmailTemplate
);
router.delete(
  "/email-templates/:key",
  authorizeAdmin(["system_config"]),
  deleteEmailTemplate
);
router.post(
  "/email-templates/:key/preview",
  authorizeAdmin(["system_config"]),
  previewEmailTemplate
);

// Subscription Plans routes
router.get(
  "/subscription-plans",
  authorizeAdmin(["system_config"]),
  getSubscriptionPlans
);
router.get(
  "/subscription-plans/:planId",
  authorizeAdmin(["system_config"]),
  getSubscriptionPlanById
);
router.post(
  "/subscription-plans",
  authorizeAdmin(["system_config"]),
  createSubscriptionPlan
);
router.put(
  "/subscription-plans/:planId",
  authorizeAdmin(["system_config"]),
  updateSubscriptionPlan
);
router.delete(
  "/subscription-plans/:planId",
  authorizeAdmin(["system_config"]),
  deleteSubscriptionPlan
);

// Payment Gateway Configuration routes
router.get(
  "/payment-gateways/:gateway/config",
  authorizeAdmin(["system_config"]),
  getPaymentGatewayConfig
);
router.put(
  "/payment-gateways/:gateway/config",
  authorizeAdmin(["system_config"]),
  updatePaymentGatewayConfig
);
router.post(
  "/payment-gateways/:gateway/test",
  authorizeAdmin(["system_config"]),
  testPaymentGatewayConnection
);

// Security Settings routes
router.get(
  "/security-settings",
  authorizeAdmin(["system_config"]),
  getSecuritySettings
);
router.get(
  "/security/settings",
  authorizeAdmin(["system_config"]),
  getSecuritySettings
);
router.put(
  "/security-settings",
  authorizeAdmin(["system_config"]),
  updateSecuritySetting
);
router.put(
  "/security/settings",
  authorizeAdmin(["system_config"]),
  updateSecuritySetting
);

// ==================== Phase 11: Notification Management ====================

// Notifications routes
router.get(
  "/notifications",
  authorizeAdmin(["notification_management"]),
  getNotifications
);
router.get(
  "/notifications/statistics",
  authorizeAdmin(["notification_management"]),
  getNotificationStatistics
);
router.get(
  "/notifications/:notificationId",
  authorizeAdmin(["notification_management"]),
  getNotificationById
);
router.post(
  "/notifications/send",
  authorizeAdmin(["notification_management"]),
  sendNotification
);
router.post(
  "/notifications/send-bulk",
  authorizeAdmin(["notification_management"]),
  sendBulkNotification
);
router.post(
  "/notifications/:notificationId/retry",
  authorizeAdmin(["notification_management"]),
  retryFailedNotification
);
router.delete(
  "/notifications/:notificationId",
  authorizeAdmin(["notification_management"]),
  deleteNotification
);

// Notification Templates routes
router.get(
  "/notification-templates",
  authorizeAdmin(["notification_management"]),
  getNotificationTemplates
);
router.get(
  "/notification-templates/:key",
  authorizeAdmin(["notification_management"]),
  getNotificationTemplateByKey
);
router.post(
  "/notification-templates",
  authorizeAdmin(["notification_management"]),
  createNotificationTemplate
);
router.put(
  "/notification-templates/:key",
  authorizeAdmin(["notification_management"]),
  updateNotificationTemplate
);
router.delete(
  "/notification-templates/:key",
  authorizeAdmin(["notification_management"]),
  deleteNotificationTemplate
);
router.post(
  "/notification-templates/:key/preview",
  authorizeAdmin(["notification_management"]),
  previewNotificationTemplate
);

// Notification Preferences routes
router.get(
  "/users/:userId/notification-preferences",
  authorizeAdmin(["notification_management"]),
  getUserNotificationPreferences
);
router.put(
  "/users/:userId/notification-preferences",
  authorizeAdmin(["notification_management"]),
  updateUserNotificationPreferences
);

// Push Tokens routes
router.get(
  "/push-tokens",
  authorizeAdmin(["notification_management"]),
  getPushTokens
);
router.delete(
  "/push-tokens/:tokenId",
  authorizeAdmin(["notification_management"]),
  deletePushToken
);

// ==================== Phase 12: Audit & Compliance ====================

// Enhanced Audit Logs routes
router.get(
  "/audit-logs/enhanced",
  authorizeAdmin(["audit_compliance"]),
  getEnhancedAuditLogs
);
router.get(
  "/audit-logs/statistics",
  authorizeAdmin(["audit_compliance"]),
  getAuditStatistics
);
router.get(
  "/audit-logs/export",
  authorizeAdmin(["audit_compliance"]),
  exportAuditLogs
);
router.get(
  "/audit-logs/:logId",
  authorizeAdmin(["audit_compliance"]),
  getAuditLogById
);

// Compliance Reports routes
router.get(
  "/compliance-reports",
  authorizeAdmin(["audit_compliance"]),
  getComplianceReports
);
router.get(
  "/compliance-reports/:reportId",
  authorizeAdmin(["audit_compliance"]),
  getComplianceReportById
);
router.post(
  "/compliance-reports/generate",
  authorizeAdmin(["audit_compliance"]),
  generateComplianceReport
);
router.delete(
  "/compliance-reports/:reportId",
  authorizeAdmin(["audit_compliance"]),
  deleteComplianceReport
);

// Data Retention Policies routes
router.get(
  "/data-retention-policies",
  authorizeAdmin(["audit_compliance"]),
  getDataRetentionPolicies
);
router.get(
  "/data-retention-policies/:policyId",
  authorizeAdmin(["audit_compliance"]),
  getDataRetentionPolicyById
);
router.post(
  "/data-retention-policies",
  authorizeAdmin(["audit_compliance"]),
  createDataRetentionPolicy
);
router.put(
  "/data-retention-policies/:policyId",
  authorizeAdmin(["audit_compliance"]),
  updateDataRetentionPolicy
);
router.delete(
  "/data-retention-policies/:policyId",
  authorizeAdmin(["audit_compliance"]),
  deleteDataRetentionPolicy
);
router.post(
  "/data-retention-policies/:policyId/apply",
  authorizeAdmin(["audit_compliance"]),
  applyDataRetentionPolicy
);

// GDPR Requests routes
router.get(
  "/gdpr-requests",
  authorizeAdmin(["audit_compliance"]),
  getGDPRRequests
);
router.get(
  "/gdpr-requests/statistics",
  authorizeAdmin(["audit_compliance"]),
  getGDPRStatistics
);
router.get(
  "/gdpr-requests/:requestId",
  authorizeAdmin(["audit_compliance"]),
  getGDPRRequestById
);
router.post(
  "/gdpr-requests/:requestId/assign",
  authorizeAdmin(["audit_compliance"]),
  assignGDPRRequest
);
router.post(
  "/gdpr-requests/:requestId/verify",
  authorizeAdmin(["audit_compliance"]),
  verifyGDPRRequest
);
router.post(
  "/gdpr-requests/:requestId/process",
  authorizeAdmin(["audit_compliance"]),
  processGDPRRequest
);
router.post(
  "/gdpr-requests/:requestId/reject",
  authorizeAdmin(["audit_compliance"]),
  rejectGDPRRequest
);
router.post(
  "/gdpr-requests/:requestId/notes",
  authorizeAdmin(["audit_compliance"]),
  addGDPRRequestNote
);

// ==================== Phase 13: Advanced Search & Filters ====================

// Global Search routes
router.get("/search/global", authorizeAdmin(["search"]), performGlobalSearch);

// Advanced Search routes
router.post(
  "/search/advanced",
  authorizeAdmin(["search"]),
  performAdvancedSearch
);

// Saved Searches routes
router.get("/saved-searches", authorizeAdmin(["search"]), getSavedSearches);
router.get(
  "/saved-searches/:searchId",
  authorizeAdmin(["search"]),
  getSavedSearchById
);
router.post("/saved-searches", authorizeAdmin(["search"]), createSavedSearch);
router.put(
  "/saved-searches/:searchId",
  authorizeAdmin(["search"]),
  updateSavedSearch
);
router.delete(
  "/saved-searches/:searchId",
  authorizeAdmin(["search"]),
  deleteSavedSearch
);
router.post(
  "/saved-searches/:searchId/execute",
  authorizeAdmin(["search"]),
  executeSavedSearch
);

// Search History routes
router.get("/search/history", authorizeAdmin(["search"]), getSearchHistory);
router.delete(
  "/search/history",
  authorizeAdmin(["search"]),
  clearSearchHistory
);
router.get("/search/analytics", authorizeAdmin(["search"]), getSearchAnalytics);

// ==================== Phase 14: Bulk Operations ====================

// Bulk User Operations routes
router.post(
  "/bulk/users/update-status",
  authorizeAdmin(["user_management"]),
  bulkUpdateUserStatus
);
router.post(
  "/bulk/users/delete",
  authorizeAdmin(["user_management"]),
  bulkDeleteUsers
);
router.post(
  "/bulk/users/export",
  authorizeAdmin(["user_management"]),
  bulkExportUsers
);
router.post(
  "/bulk/users/assign-role",
  authorizeAdmin(["user_management"]),
  bulkAssignRole
);

// Bulk Vendor Operations routes
router.post(
  "/bulk/vendors/approve",
  authorizeAdmin(["vendor_management"]),
  bulkApproveVendors
);
router.post(
  "/bulk/vendors/reject",
  authorizeAdmin(["vendor_management"]),
  bulkRejectVendors
);
router.post(
  "/bulk/vendors/suspend",
  authorizeAdmin(["vendor_management"]),
  bulkSuspendVendors
);
router.post(
  "/bulk/vendors/update-category",
  authorizeAdmin(["vendor_management"]),
  bulkUpdateVendorCategory
);

// Bulk Content Moderation routes
router.post(
  "/bulk/content/approve",
  authorizeAdmin(["moderation"]),
  bulkApproveContent
);
router.post(
  "/bulk/content/remove",
  authorizeAdmin(["moderation"]),
  bulkRemoveContent
);
router.post(
  "/bulk/content/dismiss",
  authorizeAdmin(["moderation"]),
  bulkDismissContent
);

// Bulk Notification Operations routes
router.post(
  "/bulk/notifications/send",
  authorizeAdmin(["notification_management"]),
  bulkSendNotifications
);
router.post(
  "/bulk/notifications/delete",
  authorizeAdmin(["notification_management"]),
  bulkDeleteNotifications
);

// Bulk Ticket Operations routes
router.post(
  "/bulk/tickets/assign",
  authorizeAdmin(["support_tickets"]),
  bulkAssignTickets
);
router.post(
  "/bulk/tickets/close",
  authorizeAdmin(["support_tickets"]),
  bulkCloseTickets
);
router.post(
  "/bulk/tickets/update-priority",
  authorizeAdmin(["support_tickets"]),
  bulkUpdateTicketPriority
);

// ==================== Phase 15: Real-time Updates ====================

// Real-time connection management routes
router.get(
  "/realtime/connected-admins",
  authorizeAdmin(["system_monitoring"]),
  getConnectedAdmins
);
router.get(
  "/realtime/connection-stats",
  authorizeAdmin(["system_monitoring"]),
  getConnectionStats
);
router.get(
  "/realtime/rooms/:room/members",
  authorizeAdmin(["system_monitoring"]),
  getRoomMembers
);
router.get(
  "/realtime/admins/:adminId/status",
  authorizeAdmin(["system_monitoring"]),
  checkAdminOnlineStatus
);

// Real-time broadcast routes
router.post(
  "/realtime/broadcast/dashboard",
  authorizeAdmin(["system_monitoring"]),
  broadcastDashboardUpdate
);
router.post(
  "/realtime/broadcast/notification/:adminId",
  authorizeAdmin(["notification_management"]),
  broadcastNotificationToAdmin
);
router.post(
  "/realtime/broadcast/alert",
  authorizeAdmin(["system_monitoring"]),
  broadcastSystemAlert
);
router.post(
  "/realtime/broadcast/room/:room",
  authorizeAdmin(["system_monitoring"]),
  broadcastToRoom
);

// Activity feed routes
router.get(
  "/realtime/activities",
  authorizeAdmin(["audit_logs"]),
  getRecentActivities
);

// ==================== Phase 16: Advanced Reporting ====================

// Report Templates routes
router.get(
  "/report-templates",
  authorizeAdmin(["analytics"]),
  getReportTemplates
);
router.get(
  "/report-templates/:templateId",
  authorizeAdmin(["analytics"]),
  getReportTemplateById
);
router.post(
  "/report-templates",
  authorizeAdmin(["analytics"]),
  createReportTemplate
);
router.put(
  "/report-templates/:templateId",
  authorizeAdmin(["analytics"]),
  updateReportTemplate
);
router.delete(
  "/report-templates/:templateId",
  authorizeAdmin(["analytics"]),
  deleteReportTemplate
);

// Scheduled Reports routes
router.get(
  "/scheduled-reports",
  authorizeAdmin(["analytics"]),
  getScheduledReports
);
router.get(
  "/scheduled-reports/:reportId",
  authorizeAdmin(["analytics"]),
  getScheduledReportById
);
router.post(
  "/scheduled-reports",
  authorizeAdmin(["analytics"]),
  createScheduledReport
);
router.put(
  "/scheduled-reports/:reportId",
  authorizeAdmin(["analytics"]),
  updateScheduledReport
);
router.delete(
  "/scheduled-reports/:reportId",
  authorizeAdmin(["analytics"]),
  deleteScheduledReport
);
router.post(
  "/scheduled-reports/:reportId/toggle",
  authorizeAdmin(["analytics"]),
  toggleScheduledReport
);

// Generated Reports routes
router.get(
  "/generated-reports",
  authorizeAdmin(["analytics"]),
  getGeneratedReports
);
router.get(
  "/generated-reports/:reportId",
  authorizeAdmin(["analytics"]),
  getGeneratedReportById
);
router.post(
  "/generated-reports/generate",
  authorizeAdmin(["analytics"]),
  generateReport
);
router.delete(
  "/generated-reports/:reportId",
  authorizeAdmin(["analytics"]),
  deleteGeneratedReport
);
router.get(
  "/generated-reports/:reportId/download",
  authorizeAdmin(["analytics"]),
  downloadReport
);

// ==================== Phase 17: System Monitoring ====================

// System Metrics routes
router.get(
  "/monitoring/metrics",
  authorizeAdmin(["system_monitoring"]),
  getSystemMetrics
);
router.get(
  "/monitoring/metrics/current",
  authorizeAdmin(["system_monitoring"]),
  getCurrentSystemMetrics
);
router.get(
  "/monitoring/metrics/:metricType/statistics",
  authorizeAdmin(["system_monitoring"]),
  getMetricStatistics
);

// Error Logs routes
router.get(
  "/monitoring/errors",
  authorizeAdmin(["system_monitoring"]),
  getErrorLogs
);
router.get(
  "/monitoring/errors/statistics",
  authorizeAdmin(["system_monitoring"]),
  getErrorStatistics
);
router.get(
  "/monitoring/errors/:errorId",
  authorizeAdmin(["system_monitoring"]),
  getErrorLogById
);
router.post(
  "/monitoring/errors/:errorId/resolve",
  authorizeAdmin(["system_monitoring"]),
  resolveError
);

// System Alerts routes
router.get(
  "/monitoring/alerts",
  authorizeAdmin(["system_monitoring"]),
  getSystemAlerts
);
router.get(
  "/monitoring/alerts/statistics",
  authorizeAdmin(["system_monitoring"]),
  getAlertStatistics
);
router.get(
  "/monitoring/alerts/:alertId",
  authorizeAdmin(["system_monitoring"]),
  getSystemAlertById
);
router.post(
  "/monitoring/alerts/:alertId/acknowledge",
  authorizeAdmin(["system_monitoring"]),
  acknowledgeAlert
);
router.post(
  "/monitoring/alerts/:alertId/resolve",
  authorizeAdmin(["system_monitoring"]),
  resolveSystemAlert
);

// System Health routes
router.get(
  "/monitoring/health",
  authorizeAdmin(["system_monitoring"]),
  getSystemHealth
);

// Admin management routes with parameters (MUST BE LAST - after all specific routes)
// These routes use :id parameter and will match any path, so they must come after specific routes
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

// Two-factor authentication routes (with :id parameter)
router.post("/:id/2fa/setup", authorizeAdmin(["super_admin"]), setupTwoFactor);
router.post(
  "/:id/2fa/verify",
  authorizeAdmin(["super_admin"]),
  validateRequest("verifyTwoFactor"),
  verifyTwoFactor
);

export default router;
