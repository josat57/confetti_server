import net from "net";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import { createError } from "../utils/error.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import User from "../models/user.model.js";
import Content from "../models/content.model.js";
import SystemConfig from "../models/systemConfig.model.js";
import Event from "../models/event.model.js";
import Payment from "../models/payment.model.js";
import Vendor from "../models/vendor.model.js";
import Announcement from "../models/announcement.model.js";
import SecurityLog from "../models/SecurityLog.model.js";
import SupportTicket from "../models/supportTicket.model.js";
import AuditLog from "../models/auditLog.model.js";
import ComplianceReport from "../models/complianceReport.model.js";
import GeneratedReport from "../models/generatedReport.model.js";
import { sendReportFile } from "../utils/report-renderer.js";
import securityMonitor from "../services/security-monitor.service.js";
import adminDashboardService from "../services/admin-dashboard.service.js";
import adminUserManagementService from "../services/admin-user-management.service.js";
import adminVendorVerificationService from "../services/admin-vendor-verification.service.js";
import adminContentModerationService from "../services/admin-content-moderation.service.js";
import adminSubscriptionBillingService from "../services/admin-subscription-billing.service.js";
import adminTransactionManagementService from "../services/admin-transaction-management.service.js";
import adminSupportTicketService from "../services/admin-support-ticket.service.js";
import adminAnalyticsReportingService from "../services/admin-analytics-reporting.service.js";
import adminSystemConfigService from "../services/admin-system-config.service.js";
import adminNotificationManagementService from "../services/admin-notification-management.service.js";
import adminAuditComplianceService from "../services/admin-audit-compliance.service.js";
import adminAdvancedSearchService from "../services/admin-advanced-search.service.js";
import adminBulkOperationsService from "../services/admin-bulk-operations.service.js";
import adminRealtimeService from "../services/admin-realtime.service.js";
import adminAdvancedReportingService from "../services/admin-advanced-reporting.service.js";
import adminSystemMonitoringService from "../services/admin-system-monitoring.service.js";
import { escapeRegExp } from "../utils/escape-regex.js";

// Helper function to set secure cookies and return tokens
const setSecureCookies = (res, admin) => {
  const accessToken = jwt.sign(
    { id: admin._id, role: admin.role, type: "admin" },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: admin._id, type: "admin_refresh" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  // Set access token cookie (short-lived)
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: "/",
  });

  // Set refresh token cookie (long-lived)
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/v1/admin/refresh",
  });

  // Return tokens for frontend use (SPAs, mobile apps)
  return { accessToken, refreshToken };
};

// Helper function to clear cookies
const clearCookies = (res) => {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/api/v1/admin/refresh" });
};

// Create initial super admin
export const createAdmin = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, permissions } =
      req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return next(createError(400, "Admin with this email already exists"));
    }

    // Create new admin (password will be hashed by the model's pre-save middleware)
    const admin = new Admin({
      email,
      password, // Pass the plain password - the model will hash it
      firstName,
      lastName,
      role,
      permissions,
    });

    await admin.save();

    // Generate JWT token
    const tokens = setSecureCookies(res, admin);

    res.status(201).json({
      status: "success",
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions,
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all admins
export const getAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().select("-password");
    res.status(200).json({
      status: "success",
      data: { admins },
    });
  } catch (error) {
    next(error);
  }
};

// Get admin by ID
export const getAdminById = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id).select("-password");
    if (!admin) {
      return next(createError(404, "Admin not found"));
    }
    res.status(200).json({
      status: "success",
      data: { admin },
    });
  } catch (error) {
    next(error);
  }
};

// Update admin
export const updateAdmin = async (req, res, next) => {
  try {
    const { firstName, lastName, email, role, permissions } = req.body;
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return next(createError(404, "Admin not found"));
    }

    // Update fields
    if (firstName) admin.firstName = firstName;
    if (lastName) admin.lastName = lastName;
    if (email) admin.email = email;
    if (role) admin.role = role;
    if (permissions) admin.permissions = permissions;

    await admin.save();

    res.status(200).json({
      status: "success",
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Change admin password
export const changeAdminPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(createError(400, "Current password and new password are required"));
    }
    if (newPassword.length < 8) {
      return next(createError(400, "New password must be at least 8 characters"));
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return next(createError(404, "Admin not found"));
    }

    const isPasswordValid = await admin.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return next(createError(401, "Current password is incorrect"));
    }

    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Delete admin
export const deleteAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) {
      return next(createError(404, "Admin not found"));
    }
    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Update admin status
export const updateAdminStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return next(createError(404, "Admin not found"));
    }

    admin.status = status;
    await admin.save();

    res.status(200).json({
      status: "success",
      data: {
        admin: {
          id: admin._id,
          status: admin.status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current authenticated admin's permissions
export const getCurrentAdminPermissions = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return next(createError(404, "Admin not found"));
    }
    res.status(200).json({
      status: "success",
      data: {
        permissions: admin.permissions,
        role: admin.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get available admin roles
export const getAdminRoles = async (req, res, next) => {
  try {
    const roles = [
      {
        value: "super_admin",
        label: "Super Admin",
        description: "Full system access with all permissions",
        permissions: "all",
      },
      {
        value: "admin",
        label: "Admin",
        description: "Standard admin with configurable permissions",
        permissions: "configurable",
      },
    ];

    res.status(200).json({
      status: "success",
      data: { roles },
    });
  } catch (error) {
    next(error);
  }
};

// Get admin permissions
export const getAdminPermissions = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return next(createError(404, "Admin not found"));
    }
    res.status(200).json({
      status: "success",
      data: {
        permissions: admin.permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update admin permissions
export const updateAdminPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return next(createError(404, "Admin not found"));
    }

    admin.permissions = permissions;
    await admin.save();

    res.status(200).json({
      status: "success",
      data: {
        admin: {
          id: admin._id,
          permissions: admin.permissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update permissions (alias for updateAdminPermissions)
export const updatePermissions = async (req, res, next) => {
  return updateAdminPermissions(req, res, next);
};

// Admin login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      securityMonitor.trackFailedLogin(email, req.ip, "Unknown admin account", { isAdmin: true }).catch(() => {});
      return next(createError(401, "Invalid email or password"));
    }

    // Check password (never log credentials)
    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      securityMonitor
        .trackFailedLogin(email, req.ip, "Invalid admin password", { userId: admin._id, isAdmin: true })
        .catch(() => {});
      return next(createError(401, "Invalid email or password"));
    }

    if (admin.isActive === false) {
      return next(createError(403, "Admin account is deactivated"));
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    securityMonitor
      .trackSuccessfulLogin(admin._id, admin.email, req.ip, req.headers["user-agent"], { isAdmin: true })
      .catch(() => {});

    // Set secure cookies and get tokens
    const tokens = setSecureCookies(res, admin);

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions,
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin logout
export const logout = async (req, res, next) => {
  try {
    // Clear cookies
    clearCookies(res);

    res.status(200).json({
      status: "success",
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
};

// Refresh admin token
export const refreshToken = async (req, res, next) => {
  try {
    // Accept refresh token from cookie or request body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return next(createError(401, "Refresh token not found"));
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (decoded.type !== "refreshToken") {
      return next(createError(401, "Invalid refresh token type"));
    }

    // Find admin
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return next(createError(401, "Admin not found or inactive"));
    }

    // Set new secure cookies and get tokens
    const tokens = setSecureCookies(res, admin);

    res.status(200).json({
      status: "success",
      message: "Token refreshed successfully",
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions,
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(createError(401, "Invalid refresh token"));
    }
    next(error);
  }
};

// Verify admin session
export const verifyAdmin = async (req, res, next) => {
  try {
    // This function is called after authenticateAdmin middleware
    // So req.admin should already be populated
    const admin = req.admin;

    if (!admin) {
      return next(createError(401, "Admin not authenticated"));
    }

    res.status(200).json({
      status: "success",
      message: "Admin session is valid",
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions,
          lastLogin: admin.lastLogin,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Setup two-factor authentication
export const setupTwoFactor = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return next(createError(404, "Admin not found"));
    }

    // Generate secret key for 2FA
    const secret = speakeasy.generateSecret({
      name: `Confetti:${admin.email}`,
    });

    // Save secret to admin
    admin.twoFactorSecret = secret.base32;
    admin.twoFactorEnabled = false;
    await admin.save();

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    res.status(200).json({
      status: "success",
      data: {
        secret: secret.base32,
        qrCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Verify two-factor authentication
export const verifyTwoFactor = async (req, res, next) => {
  try {
    const { token } = req.body;
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return next(createError(404, "Admin not found"));
    }

    if (!admin.twoFactorSecret) {
      return next(createError(400, "2FA not set up"));
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: "base32",
      token,
    });

    if (!verified) {
      return next(createError(400, "Invalid 2FA token"));
    }

    // Enable 2FA
    admin.twoFactorEnabled = true;
    await admin.save();

    res.status(200).json({
      status: "success",
      message: "2FA verified and enabled",
    });
  } catch (error) {
    next(error);
  }
};

// User Management
export const getUsers = async (req, res, next) => {
  try {
    const { page, limit, search, role, status, tier, sortBy, sortOrder } =
      req.query;

    const result = await adminUserManagementService.getUsers({
      page,
      limit,
      search,
      role,
      status,
      tier,
      sortBy,
      sortOrder,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await adminUserManagementService.getUserById(
      req.params.userId
    );

    res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserActivityLog = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const activityLog = await adminUserManagementService.getUserActivityLog(
      req.params.userId,
      limit ? parseInt(limit) : 50
    );

    res.status(200).json({
      status: "success",
      data: { activityLog },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const { userId } = req.params;
    const adminId = req.admin._id;

    let user;

    if (status === "suspended") {
      user = await adminUserManagementService.suspendUser(
        userId,
        adminId,
        reason
      );
    } else if (status === "active") {
      user = await adminUserManagementService.activateUser(userId, adminId);
    } else {
      user = await adminUserManagementService.updateUser(
        userId,
        { status },
        adminId
      );
    }

    res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const { userId } = req.params;
    const adminId = req.admin._id;

    const user = await adminUserManagementService.updateUser(
      userId,
      { role },
      adminId
    );

    res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const adminId = req.admin._id;

    const result = await adminUserManagementService.deleteUser(userId, adminId);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserInfo = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const adminId = req.admin._id;
    const updates = req.body;

    const user = await adminUserManagementService.updateUser(
      userId,
      updates,
      adminId
    );

    res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const exportUsers = async (req, res, next) => {
  try {
    const filters = req.query;
    const users = await adminUserManagementService.exportUsers(filters);

    res.status(200).json({
      status: "success",
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

// Content Management
export const getContent = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      contentType,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // Add search filter
    if (search) {
      query.$or = [
        { title: { $regex: escapeRegExp(search), $options: "i" } },
        { description: { $regex: escapeRegExp(search), $options: "i" } },
        { content: { $regex: escapeRegExp(search), $options: "i" } },
      ];
    }

    // Add content type filter
    if (contentType) {
      query.contentType = contentType;
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const content = await Content.find(query)
      .populate("createdBy", "firstName lastName email")
      .populate("moderatedBy", "firstName lastName email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Content.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        content,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const manageContent = async (req, res, next) => {
  try {
    const { action, contentId, content } = req.body;
    let result;

    switch (action) {
      case "create":
        result = await Content.create(content);
        break;
      case "update":
        result = await Content.findByIdAndUpdate(contentId, content, {
          new: true,
        });
        break;
      case "delete":
        result = await Content.findByIdAndDelete(contentId);
        break;
      default:
        return next(createError(400, "Invalid action"));
    }

    res.status(200).json({
      status: "success",
      data: { content: result },
    });
  } catch (error) {
    next(error);
  }
};

export const getContentStats = async (req, res, next) => {
  try {
    // Get total content count
    const totalContent = await Content.countDocuments();

    // Get content by status
    const statusStats = await Content.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get content by type
    const typeStats = await Content.aggregate([
      {
        $group: {
          _id: "$contentType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get content created in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentContent = await Content.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get moderation stats
    const moderationStats = await Content.aggregate([
      {
        $group: {
          _id: "$moderationStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: {
        totalContent,
        recentContent,
        statusBreakdown: statusStats.reduce((acc, item) => {
          acc[item._id || "unknown"] = item.count;
          return acc;
        }, {}),
        typeBreakdown: typeStats.reduce((acc, item) => {
          acc[item._id || "unknown"] = item.count;
          return acc;
        }, {}),
        moderationBreakdown: moderationStats.reduce((acc, item) => {
          acc[item._id || "unmoderated"] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getContentCategories = async (req, res, next) => {
  try {
    // Get all unique content types
    const contentTypes = await Content.distinct("contentType");

    // Get all unique statuses
    const statuses = await Content.distinct("status");

    // Get all unique moderation statuses
    const moderationStatuses = await Content.distinct("moderationStatus");

    // Predefined categories with metadata
    const categoryMetadata = {
      article: { name: "Article", description: "Blog posts and articles" },
      event: { name: "Event", description: "Event-related content" },
      vendor: { name: "Vendor", description: "Vendor profiles and services" },
      review: { name: "Review", description: "User reviews and ratings" },
      comment: {
        name: "Comment",
        description: "User comments and discussions",
      },
      media: { name: "Media", description: "Images, videos, and other media" },
      announcement: {
        name: "Announcement",
        description: "System announcements",
      },
      other: { name: "Other", description: "Miscellaneous content" },
    };

    const statusMetadata = {
      draft: { name: "Draft", description: "Content in draft state" },
      published: { name: "Published", description: "Live published content" },
      archived: { name: "Archived", description: "Archived content" },
      deleted: { name: "Deleted", description: "Soft-deleted content" },
    };

    const moderationMetadata = {
      pending: { name: "Pending", description: "Awaiting moderation" },
      approved: { name: "Approved", description: "Approved content" },
      rejected: { name: "Rejected", description: "Rejected content" },
      flagged: { name: "Flagged", description: "Flagged for review" },
    };

    res.status(200).json({
      status: "success",
      data: {
        contentTypes: contentTypes.map((type) => ({
          value: type,
          ...(categoryMetadata[type] || {
            name: type,
            description: `${type} content`,
          }),
        })),
        statuses: statuses.map((status) => ({
          value: status,
          ...(statusMetadata[status] || {
            name: status,
            description: `${status} status`,
          }),
        })),
        moderationStatuses: moderationStatuses.map((status) => ({
          value: status,
          ...(moderationMetadata[status] || {
            name: status,
            description: `${status} moderation`,
          }),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// System Configuration (Legacy - kept for backward compatibility)
export const updateSystemConfigLegacy = async (req, res, next) => {
  try {
    const { config } = req.body;
    const systemConfig = await SystemConfig.findOneAndUpdate(
      {},
      { $set: config },
      { new: true, upsert: true }
    );

    res.status(200).json({
      status: "success",
      data: { config: systemConfig },
    });
  } catch (error) {
    next(error);
  }
};

// Moderation (Legacy - kept for backward compatibility)
export const moderateContent = async (req, res, next) => {
  try {
    const { action, reason } = req.body;
    const content = await Content.findById(req.params.contentId);

    if (!content) {
      return next(createError(404, "Content not found"));
    }

    content.moderationStatus = action;
    content.moderationReason = reason;
    content.moderatedBy = req.admin._id;
    content.moderatedAt = new Date();

    await content.save();

    res.status(200).json({
      status: "success",
      data: { content },
    });
  } catch (error) {
    next(error);
  }
};

// Content Moderation (New System)
export const getFlaggedContent = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      contentType,
      status,
      priority,
      reason,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await adminContentModerationService.getFlaggedContent({
      page,
      limit,
      contentType,
      status,
      priority,
      reason,
      sortBy,
      sortOrder,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getFlaggedContentById = async (req, res, next) => {
  try {
    const { flaggedContentId } = req.params;

    const flaggedContent =
      await adminContentModerationService.getFlaggedContentById(
        flaggedContentId
      );

    res.status(200).json({
      status: "success",
      data: { flaggedContent },
    });
  } catch (error) {
    next(error);
  }
};

export const approveFlaggedContent = async (req, res, next) => {
  try {
    const { flaggedContentId } = req.params;
    const { notes } = req.body;
    const adminId = req.admin._id;

    const result = await adminContentModerationService.approveContent(
      flaggedContentId,
      adminId,
      notes
    );

    res.status(200).json({
      status: "success",
      message: "Content approved, report dismissed",
      data: { flaggedContent: result },
    });
  } catch (error) {
    next(error);
  }
};

export const removeFlaggedContent = async (req, res, next) => {
  try {
    const { flaggedContentId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin._id;

    const result = await adminContentModerationService.removeContent(
      flaggedContentId,
      adminId,
      reason
    );

    res.status(200).json({
      status: "success",
      message: "Content removed successfully",
      data: { flaggedContent: result },
    });
  } catch (error) {
    next(error);
  }
};

export const banUserFromFlaggedContent = async (req, res, next) => {
  try {
    const { flaggedContentId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin._id;

    const result = await adminContentModerationService.banUser(
      flaggedContentId,
      adminId,
      reason
    );

    res.status(200).json({
      status: "success",
      message: "User banned successfully",
      data: { flaggedContent: result },
    });
  } catch (error) {
    next(error);
  }
};

export const sendWarningToUser = async (req, res, next) => {
  try {
    const { flaggedContentId } = req.params;
    const { message } = req.body;
    const adminId = req.admin._id;

    const result = await adminContentModerationService.sendWarning(
      flaggedContentId,
      adminId,
      message
    );

    res.status(200).json({
      status: "success",
      message: "Warning sent to user",
      data: { flaggedContent: result },
    });
  } catch (error) {
    next(error);
  }
};

export const getModerationHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;

    const history = await adminContentModerationService.getModerationHistory(
      userId,
      limit ? parseInt(limit) : 50
    );

    res.status(200).json({
      status: "success",
      data: { history },
    });
  } catch (error) {
    next(error);
  }
};

export const getModerationStatistics = async (req, res, next) => {
  try {
    const statistics =
      await adminContentModerationService.getModerationStatistics();

    res.status(200).json({
      status: "success",
      data: statistics,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkModerationAction = async (req, res, next) => {
  try {
    const { flaggedContentIds, action, options } = req.body;
    const adminId = req.admin._id;

    const result = await adminContentModerationService.bulkAction(
      flaggedContentIds,
      action,
      adminId,
      options
    );

    res.status(200).json({
      status: "success",
      message: "Bulk action completed",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateFlaggedContentPriority = async (req, res, next) => {
  try {
    const { flaggedContentId } = req.params;
    const { priority } = req.body;
    const adminId = req.admin._id;

    const result = await adminContentModerationService.updatePriority(
      flaggedContentId,
      priority,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Priority updated",
      data: { flaggedContent: result },
    });
  } catch (error) {
    next(error);
  }
};

export const assignFlaggedContent = async (req, res, next) => {
  try {
    const { flaggedContentId } = req.params;
    const adminId = req.admin._id;

    const result = await adminContentModerationService.assignToAdmin(
      flaggedContentId,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Flagged content assigned for review",
      data: { flaggedContent: result },
    });
  } catch (error) {
    next(error);
  }
};

export const exportFlaggedContent = async (req, res, next) => {
  try {
    const filters = req.query;
    const data = await adminContentModerationService.exportFlaggedContent(
      filters
    );

    res.status(200).json({
      status: "success",
      data: { flaggedContent: data },
    });
  } catch (error) {
    next(error);
  }
};

// Support Tickets (Enhanced)
export const getSupportTickets = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      status,
      priority,
      category,
      assignedTo,
      escalated,
      search,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await adminSupportTicketService.getTickets({
      page,
      limit,
      status,
      priority,
      category,
      assignedTo,
      escalated,
      search,
      sortBy,
      sortOrder,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getTicketById = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const ticket = await adminSupportTicketService.getTicketById(ticketId);

    res.status(200).json({
      status: "success",
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

export const assignTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { adminId } = req.body;
    const assignedBy = req.admin._id;

    const ticket = await adminSupportTicketService.assignTicket(
      ticketId,
      adminId,
      assignedBy
    );

    res.status(200).json({
      status: "success",
      message: "Ticket assigned successfully",
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

export const respondToTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { content, attachments } = req.body;
    const adminId = req.admin._id;

    const ticket = await adminSupportTicketService.respondToTicket(
      ticketId,
      adminId,
      content,
      attachments
    );

    res.status(200).json({
      status: "success",
      message: "Response added successfully",
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

export const closeTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { resolution } = req.body;
    const adminId = req.admin._id;

    const ticket = await adminSupportTicketService.closeTicket(
      ticketId,
      adminId,
      resolution
    );

    res.status(200).json({
      status: "success",
      message: "Ticket closed successfully",
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

export const escalateTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin._id;

    const ticket = await adminSupportTicketService.escalateTicket(
      ticketId,
      adminId,
      reason
    );

    res.status(200).json({
      status: "success",
      message: "Ticket escalated successfully",
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTicketPriority = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { priority } = req.body;
    const adminId = req.admin._id;

    const ticket = await adminSupportTicketService.updatePriority(
      ticketId,
      priority,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Priority updated successfully",
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

export const addTicketInternalNote = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { note } = req.body;
    const adminId = req.admin._id;

    const ticket = await adminSupportTicketService.addInternalNote(
      ticketId,
      adminId,
      note
    );

    res.status(200).json({
      status: "success",
      message: "Internal note added",
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

export const getTicketStatistics = async (req, res, next) => {
  try {
    const statistics = await adminSupportTicketService.getTicketStatistics();

    res.status(200).json({
      status: "success",
      data: { statistics },
    });
  } catch (error) {
    next(error);
  }
};

export const getCannedResponses = async (req, res, next) => {
  try {
    const { category, search } = req.query;

    const responses = await adminSupportTicketService.getCannedResponses({
      category,
      search,
    });

    res.status(200).json({
      status: "success",
      data: { responses },
    });
  } catch (error) {
    next(error);
  }
};

export const createCannedResponse = async (req, res, next) => {
  try {
    const data = req.body;
    const adminId = req.admin._id;

    const response = await adminSupportTicketService.createCannedResponse(
      data,
      adminId
    );

    res.status(201).json({
      status: "success",
      message: "Canned response created",
      data: { response },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCannedResponse = async (req, res, next) => {
  try {
    const { responseId } = req.params;
    const updates = req.body;
    const adminId = req.admin._id;

    const response = await adminSupportTicketService.updateCannedResponse(
      responseId,
      updates,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Canned response updated",
      data: { response },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCannedResponse = async (req, res, next) => {
  try {
    const { responseId } = req.params;
    const adminId = req.admin._id;

    const result = await adminSupportTicketService.deleteCannedResponse(
      responseId,
      adminId
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const useCannedResponse = async (req, res, next) => {
  try {
    const { responseId } = req.params;

    const response = await adminSupportTicketService.useCannedResponse(
      responseId
    );

    res.status(200).json({
      status: "success",
      data: { response },
    });
  } catch (error) {
    next(error);
  }
};

export const exportTickets = async (req, res, next) => {
  try {
    const filters = req.query;
    const tickets = await adminSupportTicketService.exportTickets(filters);

    res.status(200).json({
      status: "success",
      data: { tickets },
    });
  } catch (error) {
    next(error);
  }
};

// Legacy method kept for backward compatibility
export const updateTicketStatus = async (req, res, next) => {
  try {
    const { status, response } = req.body;
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.ticketId,
      {
        status,
        adminResponse: response,
        respondedBy: req.admin._id,
        respondedAt: new Date(),
      },
      { new: true }
    );

    if (!ticket) {
      return next(createError(404, "Ticket not found"));
    }

    res.status(200).json({
      status: "success",
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

// Audit Logs
export const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find()
      .populate("admin", "email firstName lastName")
      .sort("-timestamp");

    res.status(200).json({
      status: "success",
      data: { logs },
    });
  } catch (error) {
    next(error);
  }
};

// Event Management
export const getEvents = async (req, res, next) => {
  try {
    const events = await Event.find()
      .populate("organizer", "email firstName lastName")
      .sort("-createdAt");

    res.status(200).json({
      status: "success",
      data: { events },
    });
  } catch (error) {
    next(error);
  }
};

// Analytics (Legacy - kept for backward compatibility)
export const getAnalytics = async (req, res, next) => {
  try {
    const analytics = {
      users: await User.countDocuments(),
      activeUsers: await User.countDocuments({ status: "active" }),
      totalEvents: await Event.countDocuments(),
      upcomingEvents: await Event.countDocuments({
        startDate: { $gt: new Date() },
      }),
      totalRevenue: await Payment.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    };

    res.status(200).json({
      status: "success",
      data: { analytics },
    });
  } catch (error) {
    next(error);
  }
};

// Enhanced Analytics & Reporting

// Unified view over compliance reports and generated (analytics/financial) reports
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const IN_PROGRESS_STATUSES = ["pending", "processing", "generating"];

const toUnifiedReport = (report, source) => {
  if (source === "compliance") {
    return {
      ...report,
      title: report.title,
      reportType: "compliance",
      subType: report.reportType,
      category: report.reportType === "financial_audit" ? "Financial" : "Compliance",
      generatedBy: report.requestedBy,
      completedAt: report.completedAt,
    };
  }
  const financial = report.reportType === "financial";
  return {
    ...report,
    title: report.name,
    reportType: financial ? "financial" : "generated",
    subType: report.reportType,
    category: financial ? "Financial" : "Analytics",
    completedAt: report.generatedAt,
  };
};

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};

const percentChange = (current, previous) => {
  if (!previous) return current > 0 ? "100.0" : "0.0";
  return (((current - previous) / previous) * 100).toFixed(1);
};

export const getReports = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      type,
      status,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const dir = sortOrder === "asc" ? 1 : -1;
    const sortField = ["createdAt", "updatedAt", "title"].includes(sortBy) ? sortBy : "createdAt";

    const statusFilter = status
      ? status === "pending"
        ? { status: { $in: IN_PROGRESS_STATUSES } }
        : { status }
      : {};
    const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;

    const complianceQuery = { ...statusFilter };
    if (searchRegex) complianceQuery.$or = [{ title: searchRegex }, { description: searchRegex }];
    const generatedQuery = { ...statusFilter };
    if (searchRegex) generatedQuery.name = searchRegex;
    if (type === "financial") generatedQuery.reportType = "financial";
    if (type === "generated") generatedQuery.reportType = { $ne: "financial" };

    const includeCompliance = !type || type === "compliance";
    const includeGenerated = !type || type === "generated" || type === "financial";

    // Fetch enough of each source to fill the requested page after merging
    const window = pageNum * limitNum;
    const complianceSort = { [sortField === "title" ? "title" : sortField]: dir, _id: dir };
    const generatedSort = { [sortField === "title" ? "name" : sortField]: dir, _id: dir };

    const [compliance, complianceTotal, generated, generatedTotal] = await Promise.all([
      includeCompliance
        ? ComplianceReport.find(complianceQuery).select("-results").sort(complianceSort).limit(window).lean()
        : [],
      includeCompliance ? ComplianceReport.countDocuments(complianceQuery) : 0,
      includeGenerated
        ? GeneratedReport.find(generatedQuery)
            .select("-data")
            .populate("template", "name reportType")
            .sort(generatedSort)
            .limit(window)
            .lean()
        : [],
      includeGenerated ? GeneratedReport.countDocuments(generatedQuery) : 0,
    ]);

    const merged = [
      ...compliance.map((r) => toUnifiedReport(r, "compliance")),
      ...generated.map((r) => toUnifiedReport(r, "generated")),
    ].sort((a, b) => {
      if (sortField === "title") return dir * String(a.title || "").localeCompare(String(b.title || ""));
      return dir * (new Date(a[sortField]) - new Date(b[sortField]));
    });

    const total = complianceTotal + generatedTotal;
    const paginatedReports = merged.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Summary across all reports (independent of filters)
    const [cByStatus, gByStatus, gFinancial] = await Promise.all([
      ComplianceReport.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      GeneratedReport.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      GeneratedReport.countDocuments({ reportType: "financial" }),
    ]);
    const statusCount = (...statuses) =>
      [...cByStatus, ...gByStatus]
        .filter((s) => statuses.includes(s._id))
        .reduce((sum, s) => sum + s.count, 0);
    const complianceCount = cByStatus.reduce((sum, s) => sum + s.count, 0);
    const generatedCount = gByStatus.reduce((sum, s) => sum + s.count, 0);

    res.status(200).json({
      status: "success",
      data: {
        reports: paginatedReports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
        summary: {
          totalReports: complianceCount + generatedCount,
          byType: {
            compliance: complianceCount,
            generated: generatedCount - gFinancial,
            financial: gFinancial,
          },
          byStatus: {
            completed: statusCount("completed"),
            pending: statusCount(...IN_PROGRESS_STATUSES),
            failed: statusCount("failed"),
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getReportsStats = async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const durationStage = (endField) => [
      { $match: { status: "completed", [endField]: { $exists: true } } },
      {
        $project: {
          createdAt: 1,
          ms: { $subtract: [`$${endField}`, "$createdAt"] },
        },
      },
      {
        $group: {
          _id: { $cond: [{ $gte: ["$createdAt", monthStart] }, "current", { $cond: [{ $gte: ["$createdAt", prevMonthStart] }, "previous", "older"] }] },
          totalMs: { $sum: "$ms" },
          count: { $sum: 1 },
        },
      },
    ];
    const monthStage = [
      { $match: { createdAt: { $gte: prevMonthStart } } },
      {
        $group: {
          _id: { $cond: [{ $gte: ["$createdAt", monthStart] }, "current", "previous"] },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        },
      },
    ];

    const [
      cByStatus,
      gByStatus,
      gFinancial,
      cMonths,
      gMonths,
      cDurations,
      gDurations,
      storage,
      recentCompliance,
      recentGenerated,
    ] = await Promise.all([
      ComplianceReport.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      GeneratedReport.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      GeneratedReport.countDocuments({ reportType: "financial" }),
      ComplianceReport.aggregate(monthStage),
      GeneratedReport.aggregate(monthStage),
      ComplianceReport.aggregate(durationStage("completedAt")),
      GeneratedReport.aggregate(durationStage("generatedAt")),
      Promise.all([
        ComplianceReport.aggregate([{ $group: { _id: null, bytes: { $sum: "$fileSize" } } }]),
        GeneratedReport.aggregate([{ $group: { _id: null, bytes: { $sum: "$fileSize" } } }]),
      ]),
      ComplianceReport.find().select("title status createdAt reportType").sort({ createdAt: -1 }).limit(10).lean(),
      GeneratedReport.find().select("name status createdAt reportType").sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const all = [...cByStatus, ...gByStatus];
    const countStatus = (...st) => all.filter((s) => st.includes(s._id)).reduce((sum, s) => sum + s.count, 0);
    const complianceCount = cByStatus.reduce((sum, s) => sum + s.count, 0);
    const generatedCount = gByStatus.reduce((sum, s) => sum + s.count, 0);
    const totalReports = complianceCount + generatedCount;
    const completedReports = countStatus("completed");
    const pendingReports = countStatus(...IN_PROGRESS_STATUSES);
    const failedReports = countStatus("failed");

    const reportsByType = {
      compliance: complianceCount,
      generated: generatedCount,
      financial: gFinancial,
      analytics: generatedCount - gFinancial,
    };

    const monthly = (period, key) =>
      [...cMonths, ...gMonths].filter((m) => m._id === period).reduce((sum, m) => sum + m[key], 0);
    const avgMinutes = (period) => {
      const rows = [...cDurations, ...gDurations].filter((d) => !period || d._id === period);
      const count = rows.reduce((s, r) => s + r.count, 0);
      return count ? rows.reduce((s, r) => s + r.totalMs, 0) / count / 60000 : null;
    };
    const fmtMinutes = (m) => (m === null ? "N/A" : `${m.toFixed(1)} min`);
    const avgCurrent = avgMinutes("current");
    const avgPrevious = avgMinutes("previous");
    const avgOverall = avgMinutes();

    const trends = {
      totalReports: {
        current: monthly("current", "total"),
        previous: monthly("previous", "total"),
        change: percentChange(monthly("current", "total"), monthly("previous", "total")),
      },
      completedReports: {
        current: monthly("current", "completed"),
        previous: monthly("previous", "completed"),
        change: percentChange(monthly("current", "completed"), monthly("previous", "completed")),
      },
      avgGenerationTime: {
        current: fmtMinutes(avgCurrent),
        previous: fmtMinutes(avgPrevious),
        change: avgCurrent !== null && avgPrevious ? percentChange(avgCurrent, avgPrevious) : "0.0",
      },
    };

    const recentActivity = [
      ...recentCompliance.map((r) => ({
        type: r.reportType === "financial_audit" ? "financial" : "compliance",
        title: r.title || "Compliance Report",
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...recentGenerated.map((r) => ({
        type: r.reportType === "financial" ? "financial" : "analytics",
        title: r.name || "Generated Report",
        status: r.status,
        createdAt: r.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    const totalBytes = storage.flat().reduce((sum, s) => sum + (s.bytes || 0), 0);

    res.status(200).json({
      status: "success",
      data: {
        overview: {
          totalReports,
          completedReports,
          pendingReports,
          failedReports,
          successRate:
            totalReports > 0
              ? ((completedReports / totalReports) * 100).toFixed(1)
              : "0",
        },
        reportsByType,
        trends,
        recentActivity,
        performance: {
          avgGenerationTime: avgOverall === null ? "N/A" : `${avgOverall.toFixed(1)} minutes`,
          totalStorageUsed: formatBytes(totalBytes),
          mostPopularType: totalReports
            ? Object.keys(reportsByType).reduce((a, b) =>
                reportsByType[a] >= reportsByType[b] ? a : b
              )
            : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await adminAnalyticsReportingService.getUserAnalytics({
      startDate,
      endDate,
    });

    res.status(200).json({
      status: "success",
      data: { analytics },
    });
  } catch (error) {
    next(error);
  }
};

export const getEventAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await adminAnalyticsReportingService.getEventAnalytics({
      startDate,
      endDate,
    });

    res.status(200).json({
      status: "success",
      data: { analytics },
    });
  } catch (error) {
    next(error);
  }
};

export const getFinancialAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics =
      await adminAnalyticsReportingService.getFinancialAnalytics({
        startDate,
        endDate,
      });

    res.status(200).json({
      status: "success",
      data: { analytics },
    });
  } catch (error) {
    next(error);
  }
};

export const getEngagementAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics =
      await adminAnalyticsReportingService.getEngagementAnalytics({
        startDate,
        endDate,
      });

    res.status(200).json({
      status: "success",
      data: { analytics },
    });
  } catch (error) {
    next(error);
  }
};

export const generateCustomReport = async (req, res, next) => {
  try {
    const config = req.body;

    const report = await adminAnalyticsReportingService.generateCustomReport(
      config
    );

    res.status(200).json({
      status: "success",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

// Vendor Management
export const getVendors = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      search,
      category,
      status,
      verificationStatus,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await adminVendorVerificationService.getVendors({
      page,
      limit,
      search,
      category,
      status,
      verificationStatus,
      sortBy,
      sortOrder,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorById = async (req, res, next) => {
  try {
    const vendor = await adminVendorVerificationService.getVerificationDetails(
      req.params.vendorId
    );

    res.status(200).json({
      status: "success",
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

export const getVerificationQueue = async (req, res, next) => {
  try {
    const { page, limit, status, sortBy, sortOrder } = req.query;

    const result = await adminVendorVerificationService.getVerificationQueue({
      page,
      limit,
      status,
      sortBy,
      sortOrder,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const approveVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const adminId = req.admin._id;

    const vendor = await adminVendorVerificationService.approveVendor(
      vendorId,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Vendor approved successfully",
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin._id;

    const vendor = await adminVendorVerificationService.rejectVendor(
      vendorId,
      adminId,
      reason
    );

    res.status(200).json({
      status: "success",
      message: "Vendor rejected",
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorPerformance = async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    const performance =
      await adminVendorVerificationService.getVendorPerformance(vendorId);

    res.status(200).json({
      status: "success",
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};

export const suspendVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin._id;

    const vendor = await adminVendorVerificationService.suspendVendor(
      vendorId,
      adminId,
      reason
    );

    res.status(200).json({
      status: "success",
      message: "Vendor suspended",
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

export const activateVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const adminId = req.admin._id;

    const vendor = await adminVendorVerificationService.activateVendor(
      vendorId,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Vendor activated",
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

export const flagVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin._id;

    const result = await adminVendorVerificationService.flagVendor(
      vendorId,
      adminId,
      reason
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateVendorCategory = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { category } = req.body;
    const adminId = req.admin._id;

    const vendor = await adminVendorVerificationService.updateVendorCategory(
      vendorId,
      category,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Vendor category updated",
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorStatistics = async (req, res, next) => {
  try {
    const statistics =
      await adminVendorVerificationService.getVendorStatistics();

    res.status(200).json({
      status: "success",
      data: { statistics },
    });
  } catch (error) {
    next(error);
  }
};

export const exportVendors = async (req, res, next) => {
  try {
    const filters = req.query;
    const vendors = await adminVendorVerificationService.exportVendors(filters);

    res.status(200).json({
      status: "success",
      data: { vendors },
    });
  } catch (error) {
    next(error);
  }
};

export const updateVendorStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const { vendorId } = req.params;
    const adminId = req.admin._id;

    let vendor;

    if (status === "suspended") {
      vendor = await adminVendorVerificationService.suspendVendor(
        vendorId,
        adminId,
        reason
      );
    } else if (status === "approved") {
      vendor = await adminVendorVerificationService.activateVendor(
        vendorId,
        adminId
      );
    } else {
      // For other status updates, use direct update
      vendor = await Vendor.findByIdAndUpdate(
        vendorId,
        { status },
        { new: true }
      );

      if (!vendor) {
        return next(createError(404, "Vendor not found"));
      }

      // Log the action
      await AuditLog.create({
        admin: adminId,
        action: "update_vendor_status",
        resource: "vendor",
        resourceId: vendorId,
        changes: { status: { to: status } },
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      status: "success",
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

// Communication Management
export const getAnnouncements = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, targetAudience } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (targetAudience) {
      query.targetAudience = targetAudience;
    }

    const announcements = await Announcement.find(query)
      .populate("createdBy", "firstName lastName email")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Announcement.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        announcements,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAnnouncementStatistics = async (req, res, next) => {
  try {
    const total = await Announcement.countDocuments();
    const byAudience = await Announcement.aggregate([
      {
        $group: {
          _id: "$targetAudience",
          count: { $sum: 1 },
        },
      },
    ]);

    const last30Days = await Announcement.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    res.status(200).json({
      status: "success",
      data: {
        statistics: {
          total,
          last30Days,
          byAudience,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const sendAnnouncement = async (req, res, next) => {
  try {
    const {
      title,
      content,
      message,
      type,
      targetAudience,
      priority,
      status,
      isSticky,
      scheduledFor,
      expiresAt,
    } = req.body;

    // Use content if provided, fallback to message for backward compatibility
    const announcementMessage = content || message;

    // Convert targetAudience to array if it's a string
    const audienceArray = Array.isArray(targetAudience)
      ? targetAudience
      : [targetAudience];

    const announcement = await Announcement.create({
      title,
      message: announcementMessage,
      type: type || "info",
      targetAudience: audienceArray,
      priority: priority || "medium",
      status: status || "published",
      isSticky: isSticky || false,
      scheduledFor: scheduledFor || null,
      expiresAt: expiresAt || null,
      createdBy: req.admin._id,
    });

    // Send notifications to target audience if published
    if (status === "published" || !status) {
      try {
        // Build user query based on target audience
        const userQuery = {};

        if (!audienceArray.includes("all")) {
          const roles = [];
          if (audienceArray.includes("users")) roles.push("user");
          if (audienceArray.includes("vendors")) roles.push("vendor");
          if (audienceArray.includes("event-planners"))
            roles.push("event-planner");
          if (audienceArray.includes("admins")) roles.push("admin");

          if (roles.length > 0) {
            userQuery.role = { $in: roles };
          }
        }

        // Get all matching users
        const users = await User.find(userQuery).select("_id").lean();
        const recipientIds = users.map((u) => u._id);

        // Send notifications using the notification service
        if (recipientIds.length > 0) {
          await adminNotificationManagementService.sendNotification(
            {
              recipients: recipientIds,
              type: "announcement",
              category: "system",
              title: title,
              message: announcementMessage,
              data: {
                announcementId: announcement._id,
                announcementType: type,
                isSticky: isSticky,
              },
              priority: priority || "medium",
              actionUrl: `/announcements/${announcement._id}`,
              actionText: "View Announcement",
              expiresIn: expiresAt
                ? Math.floor((new Date(expiresAt) - Date.now()) / 1000)
                : null,
            },
            req.admin.id
          );
        }

        // Log audit
        await AuditLog.create({
          admin: req.admin.id,
          action: "announcement_sent",
          resourceType: "announcement",
          resourceId: announcement._id,
          details: {
            title,
            targetAudience: audienceArray,
            recipientCount: recipientIds.length,
          },
        });
      } catch (notificationError) {
        console.error(
          "Error sending announcement notifications:",
          notificationError
        );
        // Don't fail the announcement creation if notifications fail
      }
    }

    res.status(201).json({
      status: "success",
      message: "Announcement created successfully",
      data: { announcement },
    });
  } catch (error) {
    next(error);
  }
};

// Security and Compliance
export const getSecurityLogs = async (req, res, next) => {
  try {
    const { event, severity, status, ip, userId, startDate, endDate, page = 1, limit = 100 } = req.query;
    const query = {};
    if (event) query.event = event;
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (ip) query.ipAddress = ip;
    if (userId && mongoose.isValidObjectId(userId)) query.$or = [{ user: userId }, { admin: userId }];
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

    const [logs, total] = await Promise.all([
      SecurityLog.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate("user", "email firstName lastName")
        .populate("admin", "email firstName lastName")
        .lean(),
      SecurityLog.countDocuments(query),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        logs,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSecurityMetrics = async (req, res, next) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      recentLogs,
      weeklyLogs,
      failedLogins,
      suspiciousActivities,
      rateLimitViolations,
      lockedAccounts,
      blockedIPs,
    ] = await Promise.all([
      SecurityLog.countDocuments(),
      SecurityLog.countDocuments({ createdAt: { $gte: last24Hours } }),
      SecurityLog.countDocuments({ createdAt: { $gte: last7Days } }),
      SecurityLog.countDocuments({ event: "failed_login", createdAt: { $gte: last24Hours } }),
      SecurityLog.countDocuments({ severity: { $in: ["high", "critical"] }, createdAt: { $gte: last7Days } }),
      SecurityLog.countDocuments({ event: "rate_limit", createdAt: { $gte: last24Hours } }),
      User.countDocuments({ lockUntil: { $gt: now } }),
      securityMonitor.getBlockedIPs().then((list) => list.length),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        metrics: {
          totalLogs,
          last24Hours: recentLogs,
          last7Days: weeklyLogs,
          failedLogins,
          suspiciousActivities,
          rateLimitViolations,
          lockedAccounts,
          blockedIPs,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBlockedIPs = async (req, res, next) => {
  try {
    const records = await securityMonitor.getBlockedIPs();
    const blockedIPs = records.map((r) => ({
      ipAddress: r.ip,
      reason: r.reason,
      source: r.source,
      count: r.hits || 0,
      lastBlocked: r.updatedAt || r.createdAt,
      expiresAt: r.expiresAt,
      lastHitAt: r.lastHitAt,
    }));

    res.status(200).json({
      status: "success",
      data: {
        blockedIPs,
        total: blockedIPs.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const blockIP = async (req, res, next) => {
  try {
    const { ip, reason, durationMinutes } = req.body || {};
    if (!ip || !net.isIP(String(ip))) {
      return next(createError(400, "A valid IPv4 or IPv6 address is required"));
    }
    if (ip === req.ip) {
      return next(createError(400, "You cannot block the IP address you are currently using"));
    }
    const minutes = durationMinutes === undefined || durationMinutes === null ? 24 * 60 : Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes < 0) {
      return next(createError(400, "durationMinutes must be a positive number (0 = permanent)"));
    }
    const record = await securityMonitor.blacklistIP(ip, reason || "Blocked by admin", minutes * 60 * 1000, {
      source: "manual",
      adminId: req.admin._id,
    });
    res.status(201).json({ status: "success", message: `IP ${ip} blocked`, data: { blockedIP: record } });
  } catch (error) {
    next(error);
  }
};

export const unblockIP = async (req, res, next) => {
  try {
    const removed = await securityMonitor.unblockIP(req.params.ip, req.admin._id);
    if (!removed) return next(createError(404, "IP address is not blocked"));
    res.status(200).json({ status: "success", message: `IP ${req.params.ip} unblocked` });
  } catch (error) {
    next(error);
  }
};

export const performSecurityAudit = async (req, res, next) => {
  try {
    const { auditType, targetResource, reason, details } = req.body;
    const adminId = req.admin._id;

    const auditors = {
      user_access_review: performUserAccessReview,
      permission_audit: performPermissionAudit,
      security_scan: performSecurityScan,
      compliance_check: performComplianceCheck,
      data_integrity_check: performDataIntegrityCheck,
      system_vulnerability_scan: performVulnerabilityScan,
      manual_investigation: async () => [
        { type: "manual", message: "Manual investigation initiated", severity: "info" },
      ],
    };

    if (!auditors[auditType]) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid audit type",
      });
    }

    const auditEntry = {
      auditType,
      targetResource: targetResource || "system",
      initiatedBy: adminId,
      reason: reason || "Manual security audit",
      details: details || {},
      status: "initiated",
      timestamp: new Date(),
      findings: [],
      recommendations: [],
    };

    try {
      auditEntry.findings = await auditors[auditType]();
    } catch (error) {
      auditEntry.findings = [{ type: "audit_error", message: `Audit failed: ${error.message}`, severity: "high" }];
    }
    auditEntry.recommendations = auditEntry.findings
      .filter((f) => f.recommendation)
      .map((f) => f.recommendation);

    auditEntry.status = "completed";
    auditEntry.completedAt = new Date();

    const severityRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    const worst = auditEntry.findings.reduce((m, f) => Math.max(m, severityRank[f.severity] ?? 0), 0);

    await SecurityLog.create({
      event: "security_audit",
      admin: adminId,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      status: worst >= 3 ? "warning" : "success",
      severity: worst >= 4 ? "critical" : worst === 3 ? "high" : worst === 2 ? "medium" : "low",
      details: {
        auditType,
        targetResource: auditEntry.targetResource,
        reason: auditEntry.reason,
        findingCount: auditEntry.findings.length,
        findings: auditEntry.findings,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Security audit completed successfully",
      data: {
        audit: auditEntry,
        summary: {
          totalFindings: auditEntry.findings.length,
          criticalFindings: auditEntry.findings.filter(
            (f) => f.severity === "critical"
          ).length,
          highFindings: auditEntry.findings.filter((f) => f.severity === "high")
            .length,
          mediumFindings: auditEntry.findings.filter(
            (f) => f.severity === "medium"
          ).length,
          lowFindings: auditEntry.findings.filter((f) => f.severity === "low")
            .length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper functions for different audit types (each returns an array of findings)
const DAY_MS = 24 * 60 * 60 * 1000;

async function performUserAccessReview() {
  const findings = [];
  const now = Date.now();

  const staleAdmins = await Admin.find({
    isActive: true,
    $or: [{ lastLogin: { $lt: new Date(now - 30 * DAY_MS) } }, { lastLogin: { $exists: false } }],
  })
    .select("email role lastLogin")
    .lean();
  if (staleAdmins.length) {
    findings.push({
      type: "inactive_admin_accounts",
      message: `${staleAdmins.length} active admin account(s) have not logged in for 30+ days`,
      severity: "high",
      count: staleAdmins.length,
      items: staleAdmins.map((a) => a.email),
      recommendation: "Deactivate admin accounts that are no longer in use",
    });
  }

  const no2fa = await Admin.find({ isActive: true, twoFactorEnabled: { $ne: true } }).select("email role").lean();
  if (no2fa.length) {
    findings.push({
      type: "admins_without_2fa",
      message: `${no2fa.length} active admin(s) do not use two-factor authentication`,
      severity: no2fa.some((a) => a.role === "super_admin") ? "high" : "medium",
      count: no2fa.length,
      items: no2fa.map((a) => `${a.email} (${a.role})`),
      recommendation: "Require two-factor authentication for every admin",
    });
  }

  const suspicious = await SecurityLog.aggregate([
    { $match: { event: "failed_login", createdAt: { $gte: new Date(now - DAY_MS) } } },
    { $group: { _id: "$details.email", failedAttempts: { $sum: 1 } } },
    { $match: { failedAttempts: { $gte: 5 } } },
    { $sort: { failedAttempts: -1 } },
  ]);
  if (suspicious.length) {
    findings.push({
      type: "suspicious_login_activity",
      message: `${suspicious.length} account(s) had 5+ failed logins in the last 24 hours`,
      severity: "medium",
      count: suspicious.length,
      items: suspicious.slice(0, 50).map((s) => `${s._id || "unknown"}: ${s.failedAttempts}`),
    });
  }

  const locked = await User.countDocuments({ lockUntil: { $gt: new Date() } });
  if (locked) {
    findings.push({ type: "locked_accounts", message: `${locked} user account(s) are currently locked`, severity: "low", count: locked });
  }

  if (!findings.length) {
    findings.push({ type: "user_access_review", message: "No access issues found", severity: "info" });
  }
  return findings;
}

async function performPermissionAudit() {
  const findings = [];
  const admins = await Admin.find({ isActive: true }).select("email role permissions").lean();
  const allPermissions = Admin.schema.path("permissions").caster.enumValues;

  const superAdmins = admins.filter((a) => a.role === "super_admin");
  if (superAdmins.length > 3) {
    findings.push({
      type: "too_many_super_admins",
      message: `${superAdmins.length} active super admins (unrestricted access)`,
      severity: "medium",
      items: superAdmins.map((a) => a.email),
      recommendation: "Limit super admin accounts to the minimum needed",
    });
  }

  const fullAccess = admins.filter(
    (a) => a.role !== "super_admin" && allPermissions.every((p) => (a.permissions || []).includes(p))
  );
  if (fullAccess.length) {
    findings.push({
      type: "over_privileged_admins",
      message: `${fullAccess.length} non-super admin(s) hold every permission`,
      severity: "medium",
      items: fullAccess.map((a) => a.email),
      recommendation: "Grant admins only the permissions their role needs",
    });
  }

  const noPermissions = admins.filter((a) => a.role !== "super_admin" && !(a.permissions || []).length);
  if (noPermissions.length) {
    findings.push({
      type: "admins_without_permissions",
      message: `${noPermissions.length} admin(s) have no permissions and cannot use protected features`,
      severity: "low",
      items: noPermissions.map((a) => a.email),
    });
  }

  // Permissions required by routes that no admin can actually be granted
  try {
    const fsMod = await import("fs");
    const pathMod = await import("path");
    const { fileURLToPath } = await import("url");
    const routesDir = pathMod.join(pathMod.dirname(fileURLToPath(import.meta.url)), "../routes");
    const required = new Set();
    for (const f of fsMod.readdirSync(routesDir).filter((f) => f.endsWith(".js"))) {
      const src = fsMod.readFileSync(pathMod.join(routesDir, f), "utf8");
      for (const m of src.matchAll(/authorizeAdmin\(\s*\[([^\]]*)\]/g)) {
        for (const p of m[1].matchAll(/["'`]([\w-]+)["'`]/g)) required.add(p[1]);
      }
    }
    const ungrantable = [...required].filter((p) => !allPermissions.includes(p));
    if (ungrantable.length) {
      findings.push({
        type: "ungrantable_route_permissions",
        message: `Routes require permission(s) that cannot be assigned to admins: ${ungrantable.join(", ")} — only super admins can use them`,
        severity: "medium",
        items: ungrantable,
        recommendation: "Add these permissions to the Admin model or change the routes to use existing permissions",
      });
    }
  } catch (error) {
    findings.push({ type: "route_scan_error", message: `Could not scan routes: ${error.message}`, severity: "low" });
  }

  if (!findings.length) {
    findings.push({ type: "permission_audit", message: "No permission issues found", severity: "info" });
  }
  return findings;
}

async function performSecurityScan() {
  const findings = [];
  const env = process.env;
  const production = env.NODE_ENV === "production";

  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "SESSION_SECRET"]) {
    const value = env[key] || "";
    if (value.length < 32) {
      findings.push({
        type: "weak_secret",
        message: `${key} is ${value ? `only ${value.length} characters` : "not set"}`,
        severity: production ? "critical" : "medium",
        recommendation: `Use a random ${key} of at least 32 characters`,
      });
    }
  }
  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    findings.push({
      type: "shared_jwt_secret",
      message: "Access and refresh tokens are signed with the same secret",
      severity: "high",
      recommendation: "Use different secrets for access and refresh tokens",
    });
  }
  if (!production) {
    findings.push({ type: "non_production_mode", message: `NODE_ENV is "${env.NODE_ENV || "undefined"}" (development error details are exposed)`, severity: "low" });
  }
  if (production && /localhost|127\.0\.0\.1/.test(env.FRONTEND_URL || "")) {
    findings.push({ type: "frontend_url", message: "FRONTEND_URL points to localhost in production", severity: "medium" });
  }

  const [blockedIps, highEvents] = await Promise.all([
    securityMonitor.getBlockedIPs(),
    SecurityLog.countDocuments({ severity: { $in: ["high", "critical"] }, createdAt: { $gte: new Date(Date.now() - DAY_MS) } }),
  ]);
  if (highEvents) {
    findings.push({
      type: "high_severity_events",
      message: `${highEvents} high/critical security event(s) in the last 24 hours`,
      severity: highEvents >= 10 ? "high" : "medium",
      recommendation: "Review the security log for the last 24 hours",
    });
  }
  if (blockedIps.length) {
    findings.push({ type: "blocked_ips", message: `${blockedIps.length} IP address(es) currently blocked`, severity: "info" });
  }

  const trends = await securityMonitor.analyzeSecurityTrends();
  for (const a of trends.anomalies) {
    findings.push({
      type: "security_anomaly",
      message: `${a.event}: ${a.last24h} in the last 24h vs daily average ${a.dailyAverage}`,
      severity: "high",
    });
  }

  if (!findings.length) {
    findings.push({ type: "security_scan", message: "No configuration or activity issues found", severity: "info" });
  }
  return findings;
}

async function performComplianceCheck() {
  const findings = [];
  const DataRetentionPolicy = (await import("../models/dataRetentionPolicy.model.js")).default;
  const GDPRRequest = (await import("../models/gdprRequest.model.js")).default;

  const policies = await DataRetentionPolicy.find({ isActive: true }).select("dataType autoDelete lastApplied").lean();
  const covered = new Set(policies.map((p) => p.dataType));
  const essential = ["user_data", "audit_logs", "payment_records", "session_data"];
  const missing = essential.filter((t) => !covered.has(t));
  if (missing.length) {
    findings.push({
      type: "missing_retention_policies",
      message: `No active retention policy for: ${missing.join(", ")}`,
      severity: "medium",
      recommendation: "Define retention periods for personal and financial data",
    });
  }
  const neverApplied = policies.filter((p) => p.autoDelete && !p.lastApplied);
  if (neverApplied.length) {
    findings.push({
      type: "retention_not_applied",
      message: `${neverApplied.length} auto-delete retention polic(ies) have never been applied`,
      severity: "low",
    });
  }

  const now = new Date();
  const overdue = await GDPRRequest.countDocuments({
    status: { $in: ["pending", "in_progress"] },
    dueDate: { $lt: now },
  });
  if (overdue) {
    findings.push({
      type: "overdue_gdpr_requests",
      message: `${overdue} data-subject request(s) are past their due date`,
      severity: "high",
      recommendation: "Resolve overdue GDPR requests (one-month statutory deadline)",
    });
  }
  const stalePending = await GDPRRequest.countDocuments({
    status: "pending",
    createdAt: { $lt: new Date(now - 7 * DAY_MS) },
    assignedTo: { $exists: false },
  });
  if (stalePending) {
    findings.push({ type: "unassigned_gdpr_requests", message: `${stalePending} GDPR request(s) unassigned for over 7 days`, severity: "medium" });
  }

  const recentAudit = await AuditLog.exists({ createdAt: { $gte: new Date(now - 30 * DAY_MS) } });
  if (!recentAudit) {
    findings.push({ type: "no_audit_activity", message: "No admin audit-log entries in the last 30 days — verify audit logging works", severity: "medium" });
  }

  if (!findings.length) {
    findings.push({ type: "compliance_check", message: "No compliance issues found", severity: "info" });
  }
  return findings;
}

async function performDataIntegrityCheck() {
  const findings = [];
  const Subscription = (await import("../models/subscription.model.js")).default;

  const orphanCount = async (Model, localField, fromCollection, extraMatch = {}) => {
    const [row] = await Model.aggregate([
      { $match: { [localField]: { $exists: true, $ne: null }, ...extraMatch } },
      { $lookup: { from: fromCollection, localField, foreignField: "_id", as: "__ref" } },
      { $match: { __ref: { $size: 0 } } },
      { $count: "n" },
    ]);
    return row?.n || 0;
  };

  const checks = [
    { label: "events whose organizer no longer exists", n: await orphanCount(Event, "organizer", User.collection.collectionName) },
    { label: "payments whose user no longer exists", n: await orphanCount(Payment, "user", User.collection.collectionName) },
    { label: "subscriptions whose user no longer exists", n: await orphanCount(Subscription, "user", User.collection.collectionName) },
    { label: "vendors whose owner no longer exists", n: await orphanCount(Vendor, "owner", User.collection.collectionName) },
  ];
  for (const c of checks.filter((c) => c.n)) {
    findings.push({ type: "orphaned_records", message: `${c.n} ${c.label}`, severity: "medium", count: c.n });
  }

  const duplicateEmails = await User.aggregate([
    { $match: { email: { $type: "string" } } },
    { $group: { _id: { $toLower: "$email" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "n" },
  ]);
  if (duplicateEmails[0]?.n) {
    findings.push({
      type: "duplicate_emails",
      message: `${duplicateEmails[0].n} email address(es) are used by more than one account (case-insensitive)`,
      severity: "high",
      recommendation: "Merge or correct duplicate accounts",
    });
  }

  const completedWithoutTxn = await Payment.countDocuments({
    status: "completed",
    $or: [{ transactionId: { $exists: false } }, { transactionId: null }, { transactionId: "" }],
  });
  if (completedWithoutTxn) {
    findings.push({
      type: "unreconciled_payments",
      message: `${completedWithoutTxn} completed payment(s) have no gateway transaction ID`,
      severity: "high",
    });
  }

  const activeExpired = await Subscription.countDocuments({ status: "active", endDate: { $lt: new Date() } });
  if (activeExpired) {
    findings.push({
      type: "stale_subscriptions",
      message: `${activeExpired} subscription(s) are marked active but past their end date`,
      severity: "medium",
    });
  }

  if (!findings.length) {
    findings.push({ type: "data_integrity", message: "No data integrity issues found", severity: "info" });
  }
  return findings;
}

async function performVulnerabilityScan() {
  const findings = [];
  const [major] = process.versions.node.split(".").map(Number);
  if (major < 20) {
    findings.push({
      type: "outdated_runtime",
      message: `Node.js ${process.versions.node} is end-of-life`,
      severity: "high",
      recommendation: "Upgrade to a supported Node.js LTS release",
    });
  }

  const mongoUri = process.env.MONGODB_URI || "";
  if (process.env.NODE_ENV === "production" && mongoUri && !/@/.test(mongoUri)) {
    findings.push({ type: "db_without_auth", message: "MONGODB_URI has no credentials (database may allow unauthenticated access)", severity: "high" });
  }

  const emailTransportSrc = await (await import("fs")).promises
    .readFile(new URL("../utils/email.js", import.meta.url), "utf8")
    .catch(() => "");
  if (/rejectUnauthorized:\s*false/.test(emailTransportSrc)) {
    findings.push({
      type: "tls_verification_disabled",
      message: "SMTP transport disables TLS certificate verification (rejectUnauthorized: false)",
      severity: "medium",
      recommendation: "Enable certificate verification for the mail server connection",
    });
  }

  const unauthProxy = process.env.TRUST_PROXY === "true";
  if (unauthProxy) {
    findings.push({
      type: "trust_all_proxies",
      message: "TRUST_PROXY=true trusts X-Forwarded-For from any client (IP spoofing)",
      severity: "medium",
      recommendation: "Set TRUST_PROXY to the number of proxy hops or trusted subnets",
    });
  }

  if (!findings.length) {
    findings.push({ type: "vulnerability_scan", message: "No known configuration vulnerabilities found", severity: "info" });
  }
  return findings;
}

// Financial Oversight
export const getFinancialReports = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { status: "completed" };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const reports = await Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalRevenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.status(200).json({
      status: "success",
      data: { reports },
    });
  } catch (error) {
    next(error);
  }
};

// Dashboard Metrics
export const getDashboardMetrics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const metrics = await adminDashboardService.getDashboardMetrics({
      startDate,
      endDate,
    });

    res.status(200).json({
      status: "success",
      data: { metrics },
    });
  } catch (error) {
    next(error);
  }
};

// Subscription & Billing Management
export const getSubscriptions = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      status,
      planType,
      planName,
      search,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await adminSubscriptionBillingService.getSubscriptions({
      page,
      limit,
      status,
      planType,
      planName,
      search,
      sortBy,
      sortOrder,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionById = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;

    const subscription =
      await adminSubscriptionBillingService.getSubscriptionById(subscriptionId);

    res.status(200).json({
      status: "success",
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

export const upgradeSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanName } = req.body;
    const adminId = req.admin._id;

    const result = await adminSubscriptionBillingService.upgradeSubscription(
      subscriptionId,
      newPlanName,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Subscription upgraded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const downgradeSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanName } = req.body;
    const adminId = req.admin._id;

    const subscription =
      await adminSubscriptionBillingService.downgradeSubscription(
        subscriptionId,
        newPlanName,
        adminId
      );

    res.status(200).json({
      status: "success",
      message: "Subscription downgrade scheduled for next billing cycle",
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin._id;

    const subscription =
      await adminSubscriptionBillingService.cancelSubscription(
        subscriptionId,
        adminId,
        reason
      );

    res.status(200).json({
      status: "success",
      message: "Subscription cancelled successfully",
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

export const issueRefund = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;
    const adminId = req.admin._id;

    const payment = await adminSubscriptionBillingService.issueRefund(
      paymentId,
      amount,
      reason,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Refund issued successfully",
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

export const getFailedPayments = async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    const result = await adminSubscriptionBillingService.getFailedPayments({
      page,
      limit,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const retryPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const adminId = req.admin._id;

    const result = await adminSubscriptionBillingService.retryPayment(
      paymentId,
      adminId
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionStatistics = async (req, res, next) => {
  try {
    const statistics =
      await adminSubscriptionBillingService.getSubscriptionStatistics();

    res.status(200).json({
      status: "success",
      data: { statistics },
    });
  } catch (error) {
    next(error);
  }
};

export const exportSubscriptions = async (req, res, next) => {
  try {
    const filters = req.query;
    const subscriptions =
      await adminSubscriptionBillingService.exportSubscriptions(filters);

    res.status(200).json({
      status: "success",
      data: { subscriptions },
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueReports = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const reports = await adminSubscriptionBillingService.getRevenueReports({
      startDate,
      endDate,
      groupBy,
    });

    res.status(200).json({
      status: "success",
      data: { reports },
    });
  } catch (error) {
    next(error);
  }
};

// Transaction Management
export const getTransactions = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      status,
      paymentType,
      paymentMethod,
      search,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await adminTransactionManagementService.getTransactions({
      page,
      limit,
      status,
      paymentType,
      paymentMethod,
      search,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy,
      sortOrder,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    const transaction =
      await adminTransactionManagementService.getTransactionById(transactionId);

    res.status(200).json({
      status: "success",
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

export const refundTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { amount, reason } = req.body;
    const adminId = req.admin._id;

    const transaction =
      await adminTransactionManagementService.refundTransaction(
        transactionId,
        amount,
        reason,
        adminId
      );

    res.status(200).json({
      status: "success",
      message: "Transaction refunded successfully",
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

export const markTransactionAsDisputed = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin._id;

    const transaction = await adminTransactionManagementService.markAsDisputed(
      transactionId,
      reason,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Transaction marked as disputed",
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

export const resolveTransactionDispute = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { resolution } = req.body;
    const adminId = req.admin._id;

    const transaction = await adminTransactionManagementService.resolveDispute(
      transactionId,
      resolution,
      adminId
    );

    res.status(200).json({
      status: "success",
      message: "Dispute resolved successfully",
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics =
      await adminTransactionManagementService.getPaymentAnalytics({
        startDate,
        endDate,
      });

    res.status(200).json({
      status: "success",
      data: { analytics },
    });
  } catch (error) {
    next(error);
  }
};

export const exportTransactions = async (req, res, next) => {
  try {
    const filters = req.query;
    const transactions =
      await adminTransactionManagementService.exportTransactions(filters);

    res.status(200).json({
      status: "success",
      data: { transactions },
    });
  } catch (error) {
    next(error);
  }
};

export const reconcilePayments = async (req, res, next) => {
  try {
    const { paymentMethod } = req.params;
    const { startDate, endDate } = req.query;

    const report = await adminTransactionManagementService.reconcilePayments(
      paymentMethod,
      { startDate, endDate }
    );

    res.status(200).json({
      status: "success",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactionTrends = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const trends = await adminTransactionManagementService.getTransactionTrends(
      {
        startDate,
        endDate,
        groupBy,
      }
    );

    res.status(200).json({
      status: "success",
      data: { trends },
    });
  } catch (error) {
    next(error);
  }
};

export const getDisputedTransactions = async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    const result =
      await adminTransactionManagementService.getDisputedTransactions({
        page,
        limit,
      });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Phase 10: System Configuration ====================

// System Configuration
export const getSystemConfigs = async (req, res, next) => {
  try {
    const configs = await adminSystemConfigService.getSystemConfigs(req.query);
    res.status(200).json({
      status: "success",
      data: { configs },
    });
  } catch (error) {
    next(error);
  }
};

export const getSystemConfigByKey = async (req, res, next) => {
  try {
    const config = await adminSystemConfigService.getSystemConfigByKey(
      req.params.key
    );
    res.status(200).json({
      status: "success",
      data: { config },
    });
  } catch (error) {
    next(error);
  }
};

export const createSystemConfig = async (req, res, next) => {
  try {
    const config = await adminSystemConfigService.createSystemConfig(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "System configuration created successfully",
      data: { config },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSystemConfig = async (req, res, next) => {
  try {
    const config = await adminSystemConfigService.updateSystemConfig(
      req.params.key,
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "System configuration updated successfully",
      data: { config },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSystemConfig = async (req, res, next) => {
  try {
    const result = await adminSystemConfigService.deleteSystemConfig(
      req.params.key,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// Feature Flags
export const getFeatureFlags = async (req, res, next) => {
  try {
    const flags = await adminSystemConfigService.getFeatureFlags(req.query);
    res.status(200).json({
      status: "success",
      data: { flags },
    });
  } catch (error) {
    next(error);
  }
};

export const getFeatureFlagByKey = async (req, res, next) => {
  try {
    const flag = await adminSystemConfigService.getFeatureFlagByKey(
      req.params.key
    );
    res.status(200).json({
      status: "success",
      data: { flag },
    });
  } catch (error) {
    next(error);
  }
};

export const createFeatureFlag = async (req, res, next) => {
  try {
    const flag = await adminSystemConfigService.createFeatureFlag(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "Feature flag created successfully",
      data: { flag },
    });
  } catch (error) {
    next(error);
  }
};

export const updateFeatureFlag = async (req, res, next) => {
  try {
    const flag = await adminSystemConfigService.updateFeatureFlag(
      req.params.key,
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Feature flag updated successfully",
      data: { flag },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleFeatureFlag = async (req, res, next) => {
  try {
    const flag = await adminSystemConfigService.toggleFeatureFlag(
      req.params.key,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Feature flag ${
        flag.isEnabled ? "enabled" : "disabled"
      } successfully`,
      data: { flag },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFeatureFlag = async (req, res, next) => {
  try {
    const result = await adminSystemConfigService.deleteFeatureFlag(
      req.params.key,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// Email Templates
export const getEmailTemplates = async (req, res, next) => {
  try {
    const templates = await adminSystemConfigService.getEmailTemplates(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: { templates },
    });
  } catch (error) {
    next(error);
  }
};

export const getEmailTemplateByKey = async (req, res, next) => {
  try {
    const template = await adminSystemConfigService.getEmailTemplateByKey(
      req.params.key
    );
    res.status(200).json({
      status: "success",
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

export const createEmailTemplate = async (req, res, next) => {
  try {
    const template = await adminSystemConfigService.createEmailTemplate(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "Email template created successfully",
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmailTemplate = async (req, res, next) => {
  try {
    const template = await adminSystemConfigService.updateEmailTemplate(
      req.params.key,
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Email template updated successfully",
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEmailTemplate = async (req, res, next) => {
  try {
    const result = await adminSystemConfigService.deleteEmailTemplate(
      req.params.key,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const previewEmailTemplate = async (req, res, next) => {
  try {
    const preview = await adminSystemConfigService.previewEmailTemplate(
      req.params.key,
      req.body.variables
    );
    res.status(200).json({
      status: "success",
      data: { preview },
    });
  } catch (error) {
    next(error);
  }
};

// Subscription Plans
export const getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = await adminSystemConfigService.getSubscriptionPlans(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: { plans },
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPlanById = async (req, res, next) => {
  try {
    const plan = await adminSystemConfigService.getSubscriptionPlanById(
      req.params.planId
    );
    res.status(200).json({
      status: "success",
      data: { plan },
    });
  } catch (error) {
    next(error);
  }
};

export const createSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await adminSystemConfigService.createSubscriptionPlan(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "Subscription plan created successfully",
      data: { plan },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await adminSystemConfigService.updateSubscriptionPlan(
      req.params.planId,
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Subscription plan updated successfully",
      data: { plan },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubscriptionPlan = async (req, res, next) => {
  try {
    const result = await adminSystemConfigService.deleteSubscriptionPlan(
      req.params.planId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// Payment Gateway Configuration
export const getPaymentGatewayConfig = async (req, res, next) => {
  try {
    const config = await adminSystemConfigService.getPaymentGatewayConfig(
      req.params.gateway
    );
    res.status(200).json({
      status: "success",
      data: { config },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePaymentGatewayConfig = async (req, res, next) => {
  try {
    const config = await adminSystemConfigService.updatePaymentGatewayConfig(
      req.params.gateway,
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Payment gateway configuration updated successfully",
      data: { config },
    });
  } catch (error) {
    next(error);
  }
};

export const testPaymentGatewayConnection = async (req, res, next) => {
  try {
    const result = await adminSystemConfigService.testPaymentGatewayConnection(
      req.params.gateway
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// General Settings (aggregated view for admin dashboard)
export const getSettings = async (req, res, next) => {
  try {
    // Get various settings that might be useful for admin dashboard
    const securitySettings =
      await adminSystemConfigService.getSecuritySettings();
    const featureFlags = await adminSystemConfigService.getFeatureFlags({
      isEnabled: true,
    });

    res.status(200).json({
      status: "success",
      data: {
        security: securitySettings,
        features: featureFlags,
        admin: {
          id: req.admin.id,
          email: req.admin.email,
          role: req.admin.role,
          permissions: req.admin.permissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Security Settings
export const getSecuritySettings = async (req, res, next) => {
  try {
    const settings = await adminSystemConfigService.getSecuritySettings();
    res.status(200).json({
      status: "success",
      data: { settings },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSecuritySetting = async (req, res, next) => {
  try {
    const { key, value } = req.body;
    const setting = await adminSystemConfigService.updateSecuritySetting(
      key,
      value,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Security setting updated successfully",
      data: { setting },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Phase 11: Notification Management ====================

// Notifications
export const getNotifications = async (req, res, next) => {
  try {
    const result = await adminNotificationManagementService.getNotifications(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getNotificationById = async (req, res, next) => {
  try {
    const notification =
      await adminNotificationManagementService.getNotificationById(
        req.params.notificationId
      );
    res.status(200).json({
      status: "success",
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

export const sendNotification = async (req, res, next) => {
  try {
    const result = await adminNotificationManagementService.sendNotification(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: `Notification sent to ${result.sent} recipients`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const sendBulkNotification = async (req, res, next) => {
  try {
    const result =
      await adminNotificationManagementService.sendBulkNotification(
        req.body,
        req.admin.id
      );
    res.status(201).json({
      status: "success",
      message: `Bulk notification sent to ${result.sent} recipients`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const retryFailedNotification = async (req, res, next) => {
  try {
    const notification =
      await adminNotificationManagementService.retryFailedNotification(
        req.params.notificationId,
        req.admin.id
      );
    res.status(200).json({
      status: "success",
      message: "Notification queued for retry",
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const result = await adminNotificationManagementService.deleteNotification(
      req.params.notificationId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const getNotificationStatistics = async (req, res, next) => {
  try {
    const statistics =
      await adminNotificationManagementService.getNotificationStatistics(
        req.query
      );
    res.status(200).json({
      status: "success",
      data: { statistics },
    });
  } catch (error) {
    next(error);
  }
};

// Notification Templates
export const getNotificationTemplates = async (req, res, next) => {
  try {
    const templates =
      await adminNotificationManagementService.getNotificationTemplates(
        req.query
      );
    res.status(200).json({
      status: "success",
      data: { templates },
    });
  } catch (error) {
    next(error);
  }
};

export const getNotificationTemplateByKey = async (req, res, next) => {
  try {
    const template =
      await adminNotificationManagementService.getNotificationTemplateByKey(
        req.params.key
      );
    res.status(200).json({
      status: "success",
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

export const createNotificationTemplate = async (req, res, next) => {
  try {
    const template =
      await adminNotificationManagementService.createNotificationTemplate(
        req.body,
        req.admin.id
      );
    res.status(201).json({
      status: "success",
      message: "Notification template created successfully",
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

export const updateNotificationTemplate = async (req, res, next) => {
  try {
    const template =
      await adminNotificationManagementService.updateNotificationTemplate(
        req.params.key,
        req.body,
        req.admin.id
      );
    res.status(200).json({
      status: "success",
      message: "Notification template updated successfully",
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotificationTemplate = async (req, res, next) => {
  try {
    const result =
      await adminNotificationManagementService.deleteNotificationTemplate(
        req.params.key,
        req.admin.id
      );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const previewNotificationTemplate = async (req, res, next) => {
  try {
    const preview =
      await adminNotificationManagementService.previewNotificationTemplate(
        req.params.key,
        req.body.variables
      );
    res.status(200).json({
      status: "success",
      data: { preview },
    });
  } catch (error) {
    next(error);
  }
};

// Notification Preferences
export const getUserNotificationPreferences = async (req, res, next) => {
  try {
    const preferences =
      await adminNotificationManagementService.getUserPreferences(
        req.params.userId
      );
    res.status(200).json({
      status: "success",
      data: { preferences },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserNotificationPreferences = async (req, res, next) => {
  try {
    const preferences =
      await adminNotificationManagementService.updateUserPreferences(
        req.params.userId,
        req.body,
        req.admin.id
      );
    res.status(200).json({
      status: "success",
      message: "Notification preferences updated successfully",
      data: { preferences },
    });
  } catch (error) {
    next(error);
  }
};

// Push Tokens
export const getPushTokens = async (req, res, next) => {
  try {
    const tokens = await adminNotificationManagementService.getPushTokens(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: { tokens },
    });
  } catch (error) {
    next(error);
  }
};

export const deletePushToken = async (req, res, next) => {
  try {
    const result = await adminNotificationManagementService.deletePushToken(
      req.params.tokenId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Phase 12: Audit & Compliance ====================

// Audit Logs
export const getEnhancedAuditLogs = async (req, res, next) => {
  try {
    const result = await adminAuditComplianceService.getAuditLogs(req.query);
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogById = async (req, res, next) => {
  try {
    const log = await adminAuditComplianceService.getAuditLogById(
      req.params.logId
    );
    res.status(200).json({
      status: "success",
      data: { log },
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditStatistics = async (req, res, next) => {
  try {
    const statistics = await adminAuditComplianceService.getAuditStatistics(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: { statistics },
    });
  } catch (error) {
    next(error);
  }
};

export const exportAuditLogs = async (req, res, next) => {
  try {
    const result = await adminAuditComplianceService.exportAuditLogs(
      req.query,
      req.query.format || "csv"
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Compliance Reports
export const getComplianceReports = async (req, res, next) => {
  try {
    const result = await adminAuditComplianceService.getComplianceReports(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Streams the rendered file for a compliance report (the `fileUrl` of the report)
export const downloadComplianceReportFile = async (req, res, next) => {
  try {
    const { report, file } = await adminAuditComplianceService.getComplianceReportFile(
      req.params.reportId
    );
    sendReportFile(res, file, report.title);
  } catch (error) {
    next(error);
  }
};

// Streams the audit-log export described by GET /audit-logs/export
export const downloadAuditLogExportFile = async (req, res, next) => {
  try {
    const { format = "csv", ...filters } = req.query;
    const file = await adminAuditComplianceService.renderAuditLogExport(filters, format);
    sendReportFile(res, file, `audit-logs-${new Date().toISOString().slice(0, 10)}`);
  } catch (error) {
    next(error);
  }
};

export const getComplianceReportById = async (req, res, next) => {
  try {
    const report = await adminAuditComplianceService.getComplianceReportById(
      req.params.reportId
    );
    res.status(200).json({
      status: "success",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

export const generateComplianceReport = async (req, res, next) => {
  try {
    const report = await adminAuditComplianceService.generateComplianceReport(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "Compliance report generation started",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComplianceReport = async (req, res, next) => {
  try {
    const result = await adminAuditComplianceService.deleteComplianceReport(
      req.params.reportId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// Data Retention Policies
export const getDataRetentionPolicies = async (req, res, next) => {
  try {
    const policies = await adminAuditComplianceService.getDataRetentionPolicies(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: { policies },
    });
  } catch (error) {
    next(error);
  }
};

export const getDataRetentionPolicyById = async (req, res, next) => {
  try {
    const policy = await adminAuditComplianceService.getDataRetentionPolicyById(
      req.params.policyId
    );
    res.status(200).json({
      status: "success",
      data: { policy },
    });
  } catch (error) {
    next(error);
  }
};

export const createDataRetentionPolicy = async (req, res, next) => {
  try {
    const policy = await adminAuditComplianceService.createDataRetentionPolicy(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "Data retention policy created successfully",
      data: { policy },
    });
  } catch (error) {
    next(error);
  }
};

export const updateDataRetentionPolicy = async (req, res, next) => {
  try {
    const policy = await adminAuditComplianceService.updateDataRetentionPolicy(
      req.params.policyId,
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Data retention policy updated successfully",
      data: { policy },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDataRetentionPolicy = async (req, res, next) => {
  try {
    const result = await adminAuditComplianceService.deleteDataRetentionPolicy(
      req.params.policyId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const applyDataRetentionPolicy = async (req, res, next) => {
  try {
    const dryRunParam = req.body?.dryRun ?? req.query?.dryRun;
    const dryRun =
      dryRunParam === undefined ? undefined : dryRunParam === true || dryRunParam === "true";
    const result = await adminAuditComplianceService.applyDataRetentionPolicy(
      req.params.policyId,
      req.admin.id,
      { dryRun }
    );
    res.status(200).json({
      status: "success",
      message:
        result.mode === "enforced"
          ? "Data retention policy applied successfully"
          : "Data retention policy evaluated (no records were removed)",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// GDPR Requests
export const getGDPRRequests = async (req, res, next) => {
  try {
    const result = await adminAuditComplianceService.getGDPRRequests(req.query);
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getGDPRRequestById = async (req, res, next) => {
  try {
    const request = await adminAuditComplianceService.getGDPRRequestById(
      req.params.requestId
    );
    res.status(200).json({
      status: "success",
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

export const assignGDPRRequest = async (req, res, next) => {
  try {
    const request = await adminAuditComplianceService.assignGDPRRequest(
      req.params.requestId,
      req.admin.id,
      req.body.assignTo
    );
    res.status(200).json({
      status: "success",
      message: "GDPR request assigned successfully",
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyGDPRRequest = async (req, res, next) => {
  try {
    const request = await adminAuditComplianceService.verifyGDPRRequest(
      req.params.requestId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "GDPR request verified successfully",
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

export const processGDPRRequest = async (req, res, next) => {
  try {
    const request = await adminAuditComplianceService.processGDPRRequest(
      req.params.requestId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "GDPR request processed successfully",
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectGDPRRequest = async (req, res, next) => {
  try {
    const request = await adminAuditComplianceService.rejectGDPRRequest(
      req.params.requestId,
      req.body.reason,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "GDPR request rejected",
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

export const addGDPRRequestNote = async (req, res, next) => {
  try {
    const request = await adminAuditComplianceService.addGDPRRequestNote(
      req.params.requestId,
      req.body.note,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Note added successfully",
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

export const getGDPRStatistics = async (req, res, next) => {
  try {
    const statistics = await adminAuditComplianceService.getGDPRStatistics(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: { statistics },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Phase 13: Advanced Search & Filters ====================

// Global Search
export const performGlobalSearch = async (req, res, next) => {
  try {
    const result = await adminAdvancedSearchService.globalSearch({
      query: req.query.q,
      limit: req.query.limit,
      adminId: req.admin.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Advanced Search
export const performAdvancedSearch = async (req, res, next) => {
  try {
    const result = await adminAdvancedSearchService.advancedSearch(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Saved Searches
export const getSavedSearches = async (req, res, next) => {
  try {
    const searches = await adminAdvancedSearchService.getSavedSearches({
      ...req.query,
      userId: req.admin.id,
    });
    res.status(200).json({
      status: "success",
      data: { searches },
    });
  } catch (error) {
    next(error);
  }
};

export const getSavedSearchById = async (req, res, next) => {
  try {
    const search = await adminAdvancedSearchService.getSavedSearchById(
      req.params.searchId
    );
    res.status(200).json({
      status: "success",
      data: { search },
    });
  } catch (error) {
    next(error);
  }
};

export const createSavedSearch = async (req, res, next) => {
  try {
    const search = await adminAdvancedSearchService.createSavedSearch(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "Saved search created successfully",
      data: { search },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSavedSearch = async (req, res, next) => {
  try {
    const search = await adminAdvancedSearchService.updateSavedSearch(
      req.params.searchId,
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Saved search updated successfully",
      data: { search },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSavedSearch = async (req, res, next) => {
  try {
    const result = await adminAdvancedSearchService.deleteSavedSearch(
      req.params.searchId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const executeSavedSearch = async (req, res, next) => {
  try {
    const result = await adminAdvancedSearchService.executeSavedSearch(
      req.params.searchId,
      req.query,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Search History
export const getSearchHistory = async (req, res, next) => {
  try {
    const result = await adminAdvancedSearchService.getSearchHistory({
      ...req.query,
      userId: req.admin.id,
    });
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const clearSearchHistory = async (req, res, next) => {
  try {
    const result = await adminAdvancedSearchService.clearSearchHistory(
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const getSearchAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminAdvancedSearchService.getSearchAnalytics({
      ...req.query,
      userId: req.admin.id,
    });
    res.status(200).json({
      status: "success",
      data: { analytics },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Phase 14: Bulk Operations ====================

// Bulk User Operations
export const bulkUpdateUserStatus = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkUpdateUserStatus(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Updated ${result.successful} users successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteUsers = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkDeleteUsers(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Deleted ${result.successful} users successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkExportUsers = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkExportUsers(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Export file generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkAssignRole = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkAssignRole(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Assigned role to ${result.successful} users successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk Vendor Operations
export const bulkApproveVendors = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkApproveVendors(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Approved ${result.successful} vendors successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkRejectVendors = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkRejectVendors(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Rejected ${result.successful} vendors successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkSuspendVendors = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkSuspendVendors(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Suspended ${result.successful} vendors successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkUpdateVendorCategory = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkUpdateVendorCategory(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Updated category for ${result.successful} vendors successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk Content Moderation
export const bulkApproveContent = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkApproveContent(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Approved ${result.successful} content items successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkRemoveContent = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkRemoveContent(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Removed ${result.successful} content items successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkDismissContent = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkDismissContent(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Dismissed ${result.successful} content items successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk Notification Operations
export const bulkSendNotifications = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkSendNotifications(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Sent notifications to ${result.successful} recipients successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteNotifications = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkDeleteNotifications(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Deleted ${result.deleted} notifications successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk Ticket Operations
export const bulkAssignTickets = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkAssignTickets(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Assigned ${result.successful} tickets successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkCloseTickets = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkCloseTickets(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Closed ${result.successful} tickets successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkUpdateTicketPriority = async (req, res, next) => {
  try {
    const result = await adminBulkOperationsService.bulkUpdateTicketPriority(
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Updated priority for ${result.successful} tickets successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Phase 15: Real-time Updates ====================

// Get connected admins
export const getConnectedAdmins = async (req, res, next) => {
  try {
    const admins = adminRealtimeService.getConnectedAdmins();
    res.status(200).json({
      status: "success",
      data: { admins },
    });
  } catch (error) {
    next(error);
  }
};

// Get connection stats
export const getConnectionStats = async (req, res, next) => {
  try {
    const stats = adminRealtimeService.getConnectionStats();
    res.status(200).json({
      status: "success",
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

// Get room members
export const getRoomMembers = async (req, res, next) => {
  try {
    const { room } = req.params;
    const members = adminRealtimeService.getRoomMembers(room);
    res.status(200).json({
      status: "success",
      data: { room, members },
    });
  } catch (error) {
    next(error);
  }
};

// Check admin online status
export const checkAdminOnlineStatus = async (req, res, next) => {
  try {
    const { adminId } = req.params;
    const isOnline = adminRealtimeService.isAdminOnline(adminId);
    res.status(200).json({
      status: "success",
      data: { adminId, isOnline },
    });
  } catch (error) {
    next(error);
  }
};

// Broadcast dashboard update
export const broadcastDashboardUpdate = async (req, res, next) => {
  try {
    adminRealtimeService.broadcastDashboardUpdate(req.body);
    res.status(200).json({
      status: "success",
      message: "Dashboard update broadcasted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Broadcast notification to admin
export const broadcastNotificationToAdmin = async (req, res, next) => {
  try {
    const { adminId } = req.params;
    adminRealtimeService.broadcastNotification(adminId, req.body);
    res.status(200).json({
      status: "success",
      message: "Notification broadcasted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Broadcast system alert
export const broadcastSystemAlert = async (req, res, next) => {
  try {
    adminRealtimeService.broadcastSystemAlert(req.body);
    res.status(200).json({
      status: "success",
      message: "System alert broadcasted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get recent activities
export const getRecentActivities = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const activities = await adminRealtimeService.getRecentActivities(limit);
    res.status(200).json({
      status: "success",
      data: { activities },
    });
  } catch (error) {
    next(error);
  }
};

// Broadcast to room
export const broadcastToRoom = async (req, res, next) => {
  try {
    const { room } = req.params;
    const { event, data } = req.body;
    adminRealtimeService.broadcastToRoom(room, event, data);
    res.status(200).json({
      status: "success",
      message: `Broadcasted to room: ${room}`,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Phase 16: Advanced Reporting ====================

// Report Templates
export const getReportTemplates = async (req, res, next) => {
  try {
    const templates = await adminAdvancedReportingService.getReportTemplates(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: { templates },
    });
  } catch (error) {
    next(error);
  }
};

export const getReportTemplateById = async (req, res, next) => {
  try {
    const template = await adminAdvancedReportingService.getReportTemplateById(
      req.params.templateId
    );
    res.status(200).json({
      status: "success",
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

export const createReportTemplate = async (req, res, next) => {
  try {
    const template = await adminAdvancedReportingService.createReportTemplate(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "Report template created successfully",
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

export const updateReportTemplate = async (req, res, next) => {
  try {
    const template = await adminAdvancedReportingService.updateReportTemplate(
      req.params.templateId,
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Report template updated successfully",
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReportTemplate = async (req, res, next) => {
  try {
    const result = await adminAdvancedReportingService.deleteReportTemplate(
      req.params.templateId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// Scheduled Reports
export const getScheduledReports = async (req, res, next) => {
  try {
    const reports = await adminAdvancedReportingService.getScheduledReports(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: { reports },
    });
  } catch (error) {
    next(error);
  }
};

export const getScheduledReportById = async (req, res, next) => {
  try {
    const report = await adminAdvancedReportingService.getScheduledReportById(
      req.params.reportId
    );
    res.status(200).json({
      status: "success",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

export const createScheduledReport = async (req, res, next) => {
  try {
    const report = await adminAdvancedReportingService.createScheduledReport(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "Scheduled report created successfully",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

export const updateScheduledReport = async (req, res, next) => {
  try {
    const report = await adminAdvancedReportingService.updateScheduledReport(
      req.params.reportId,
      req.body,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Scheduled report updated successfully",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteScheduledReport = async (req, res, next) => {
  try {
    const result = await adminAdvancedReportingService.deleteScheduledReport(
      req.params.reportId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const toggleScheduledReport = async (req, res, next) => {
  try {
    const report = await adminAdvancedReportingService.toggleScheduledReport(
      req.params.reportId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: `Scheduled report ${
        report.isActive ? "activated" : "deactivated"
      } successfully`,
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

// Generated Reports
export const getGeneratedReports = async (req, res, next) => {
  try {
    const result = await adminAdvancedReportingService.getGeneratedReports(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getGeneratedReportById = async (req, res, next) => {
  try {
    const report = await adminAdvancedReportingService.getGeneratedReportById(
      req.params.reportId
    );
    res.status(200).json({
      status: "success",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

export const generateReport = async (req, res, next) => {
  try {
    const report = await adminAdvancedReportingService.generateReport(
      req.body,
      req.admin.id
    );
    res.status(201).json({
      status: "success",
      message: "Report generation started",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteGeneratedReport = async (req, res, next) => {
  try {
    const result = await adminAdvancedReportingService.deleteGeneratedReport(
      req.params.reportId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadReport = async (req, res, next) => {
  try {
    const result = await adminAdvancedReportingService.downloadReport(
      req.params.reportId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Streams the rendered file for a generated report (the `fileUrl` of the report)
export const downloadGeneratedReportFile = async (req, res, next) => {
  try {
    const { report, file } = await adminAdvancedReportingService.getGeneratedReportFile(
      req.params.reportId
    );
    sendReportFile(res, file, report.name);
  } catch (error) {
    next(error);
  }
};

// ==================== Phase 17: System Monitoring ====================

// System Metrics
export const getSystemMetrics = async (req, res, next) => {
  try {
    const metrics = await adminSystemMonitoringService.getSystemMetrics(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: { metrics },
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentSystemMetrics = async (req, res, next) => {
  try {
    const metrics =
      await adminSystemMonitoringService.getCurrentSystemMetrics();
    res.status(200).json({
      status: "success",
      data: { metrics },
    });
  } catch (error) {
    next(error);
  }
};

export const getMetricStatistics = async (req, res, next) => {
  try {
    const { metricType } = req.params;
    const { timeRange } = req.query;
    const statistics = await adminSystemMonitoringService.getMetricStatistics(
      metricType,
      timeRange
    );
    res.status(200).json({
      status: "success",
      data: { statistics },
    });
  } catch (error) {
    next(error);
  }
};

// Error Logs
export const getErrorLogs = async (req, res, next) => {
  try {
    const result = await adminSystemMonitoringService.getErrorLogs(req.query);
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getErrorLogById = async (req, res, next) => {
  try {
    const error = await adminSystemMonitoringService.getErrorLogById(
      req.params.errorId
    );
    res.status(200).json({
      status: "success",
      data: { error },
    });
  } catch (error) {
    next(error);
  }
};

export const resolveError = async (req, res, next) => {
  try {
    const error = await adminSystemMonitoringService.resolveError(
      req.params.errorId,
      req.body.resolution,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Error resolved successfully",
      data: { error },
    });
  } catch (error) {
    next(error);
  }
};

export const getErrorStatistics = async (req, res, next) => {
  try {
    const { timeRange } = req.query;
    const statistics = await adminSystemMonitoringService.getErrorStatistics(
      timeRange
    );
    res.status(200).json({
      status: "success",
      data: { statistics },
    });
  } catch (error) {
    next(error);
  }
};

// System Alerts
export const getSystemAlerts = async (req, res, next) => {
  try {
    const result = await adminSystemMonitoringService.getSystemAlerts(
      req.query
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSystemAlertById = async (req, res, next) => {
  try {
    const alert = await adminSystemMonitoringService.getSystemAlertById(
      req.params.alertId
    );
    res.status(200).json({
      status: "success",
      data: { alert },
    });
  } catch (error) {
    next(error);
  }
};

export const acknowledgeAlert = async (req, res, next) => {
  try {
    const alert = await adminSystemMonitoringService.acknowledgeAlert(
      req.params.alertId,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Alert acknowledged successfully",
      data: { alert },
    });
  } catch (error) {
    next(error);
  }
};

export const resolveSystemAlert = async (req, res, next) => {
  try {
    const alert = await adminSystemMonitoringService.resolveAlert(
      req.params.alertId,
      req.body.resolution,
      req.admin.id
    );
    res.status(200).json({
      status: "success",
      message: "Alert resolved successfully",
      data: { alert },
    });
  } catch (error) {
    next(error);
  }
};

export const getAlertStatistics = async (req, res, next) => {
  try {
    const statistics = await adminSystemMonitoringService.getAlertStatistics();
    res.status(200).json({
      status: "success",
      data: { statistics },
    });
  } catch (error) {
    next(error);
  }
};

// System Health
export const getSystemHealth = async (req, res, next) => {
  try {
    const health = await adminSystemMonitoringService.getSystemHealth();
    res.status(200).json({
      status: "success",
      data: { health },
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPayments = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const payments = await Payment.find({ subscription: subscriptionId })
      .sort("-createdAt")
      .lean();
    res.status(200).json({
      status: "success",
      data: { payments },
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionChanges = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const Subscription = (await import("../models/subscription.model.js")).default;
    const subscription = await Subscription.findById(subscriptionId)
      .select("history")
      .lean();
    if (!subscription) {
      return next(createError(404, "Subscription not found"));
    }
    res.status(200).json({
      status: "success",
      data: { changes: subscription.history || [] },
    });
  } catch (error) {
    next(error);
  }
};
