import express from 'express';
import { validateRequest } from '../middleware/validation.js';
import { authenticateAdmin, authorizeAdmin } from '../middleware/auth.js';
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
  manageContent,
  updateSystemConfig,
  moderateContent,
  getSupportTickets,
  updateTicketStatus,
  getAuditLogs,
  getAnalytics,
  getVendors,
  updateVendorStatus,
  sendAnnouncement,
  getSecurityLogs,
  getFinancialReports
} from '../controllers/admin.controller.js';

const router = express.Router();

// Public routes
router.post('/super-admin', validateRequest('createAdmin'), createAdmin);
router.post('/login', validateRequest('login'), login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);

// Protected routes
router.use(authenticateAdmin);

// Admin management routes
router.get('/verify', verifyAdmin);
router.get('/', getAdmins);
router.get('/:id', getAdminById);
router.put('/:id', validateRequest('updateAdmin'), updateAdmin);
router.delete('/:id', deleteAdmin);
router.patch('/:id/status', validateRequest('updateStatus'), updateAdminStatus);
router.get('/:id/permissions', getAdminPermissions);
router.put('/:id/permissions', validateRequest('updatePermissions'), updateAdminPermissions);

// Two-factor authentication routes
router.post('/:id/2fa/setup',
  authorizeAdmin(['super_admin']),
  setupTwoFactor
);

router.post('/:id/2fa/verify',
  authorizeAdmin(['super_admin']),
  validateRequest('verifyTwoFactor'),
  verifyTwoFactor
);

// User management routes
router.get('/users',
  authorizeAdmin(['user_management']),
  getUsers
);

router.put('/users/:userId/status',
  authorizeAdmin(['user_management']),
  validateRequest('updateUserStatus'),
  updateUserStatus
);

// Content management routes
router.post('/content',
  authorizeAdmin(['content_management']),
  validateRequest('manageContent'),
  manageContent
);

// System configuration routes
router.put('/config',
  authorizeAdmin(['system_configuration']),
  validateRequest('updateSystemConfig'),
  updateSystemConfig
);

// Moderation routes
router.put('/content/:contentId/moderate',
  authorizeAdmin(['moderation']),
  validateRequest('moderateContent'),
  moderateContent
);

// Support ticket routes
router.get('/tickets',
  authorizeAdmin(['support_tickets']),
  getSupportTickets
);

router.put('/tickets/:ticketId/status',
  authorizeAdmin(['support_tickets']),
  validateRequest('updateTicketStatus'),
  updateTicketStatus
);

// Audit log routes
router.get('/audit-logs',
  authorizeAdmin(['audit_logs']),
  getAuditLogs
);

// Analytics routes
router.get('/analytics',
  authorizeAdmin(['analytics']),
  getAnalytics
);

// Vendor management routes
router.get('/vendors',
  authorizeAdmin(['vendor_management']),
  getVendors
);

router.put('/vendors/:vendorId/status',
  authorizeAdmin(['vendor_management']),
  validateRequest('updateVendorStatus'),
  updateVendorStatus
);

// Communication management routes
router.post('/announcements',
  authorizeAdmin(['communication_management']),
  validateRequest('sendAnnouncement'),
  sendAnnouncement
);

// Security and compliance routes
router.get('/security-logs',
  authorizeAdmin(['security_compliance']),
  getSecurityLogs
);

// Financial oversight routes
router.get('/financial-reports',
  authorizeAdmin(['financial_oversight']),
  getFinancialReports
);

export default router; 