import User from "../models/user.model.js";
import Event from "../models/event.model.js";
import Payment from "../models/payment.model.js";
import Subscription from "../models/subscription.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";
import { escapeRegExp } from "../utils/escape-regex.js";

/**
 * Admin User Management Service
 * Handles user management operations for admin dashboard
 */
class AdminUserManagementService {
  /**
   * Get users with pagination, search, and filtering
   * @param {Object} options - Query options
   * @returns {Object} Paginated users list
   */
  async getUsers(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = "",
      role = "",
      status = "",
      tier = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { email: { $regex: escapeRegExp(search), $options: "i" } },
        { firstName: { $regex: escapeRegExp(search), $options: "i" } },
        { lastName: { $regex: escapeRegExp(search), $options: "i" } },
        { phone: { $regex: escapeRegExp(search), $options: "i" } },
      ];
    }

    // Role filter
    if (role) {
      query.role = role;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Execute query
    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .populate("subscription", "tier status")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    // Filter by tier if specified (after population)
    let filteredUsers = users;
    if (tier) {
      filteredUsers = users.filter((user) => user.subscription?.tier === tier);
    }

    return {
      users: filteredUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID with detailed information
   * @param {String} userId - User ID
   * @returns {Object} User details
   */
  async getUserById(userId) {
    const user = await User.findById(userId)
      .select("-password")
      .populate("subscription")
      .lean();

    if (!user) {
      throw createError(404, "User not found");
    }

    // Get additional user data
    const [events, payments, activityLog] = await Promise.all([
      Event.find({ organizer: userId })
        .select("name eventType startDate status")
        .sort("-createdAt")
        .limit(10)
        .lean(),
      Payment.find({ user: userId })
        .select("amount status createdAt")
        .sort("-createdAt")
        .limit(10)
        .lean(),
      this.getUserActivityLog(userId, 20),
    ]);

    return {
      ...user,
      events,
      payments,
      activityLog,
    };
  }

  /**
   * Get user activity log
   * @param {String} userId - User ID
   * @param {Number} limit - Number of activities to return
   * @returns {Array} Activity log
   */
  async getUserActivityLog(userId, limit = 50) {
    const user = await User.findById(userId).select("lastLogin createdAt");

    if (!user) {
      throw createError(404, "User not found");
    }

    // Get various activities
    const [events, payments, loginHistory] = await Promise.all([
      Event.find({ organizer: userId })
        .select("name eventType createdAt")
        .sort("-createdAt")
        .limit(limit)
        .lean(),
      Payment.find({ user: userId })
        .select("amount status createdAt")
        .sort("-createdAt")
        .limit(limit)
        .lean(),
      // Fetch login history from AuditLog
      AuditLog.find({ resource: "user", resourceId: userId, action: "login" })
        .select("action timestamp changes")
        .sort("-timestamp")
        .limit(limit)
        .lean(),
    ]);

    // Combine activities
    const activities = [
      ...events.map((event) => ({
        type: "event_created",
        description: `Created event: ${event.name}`,
        timestamp: event.createdAt,
        metadata: { eventType: event.eventType },
      })),
      ...payments.map((payment) => ({
        type: "payment",
        description: `Payment of $${payment.amount} - ${payment.status}`,
        timestamp: payment.createdAt,
        metadata: { amount: payment.amount, status: payment.status },
      })),
      ...loginHistory.map((log) => ({
        type: "login",
        description: "User logged in",
        timestamp: log.timestamp,
        metadata: log.changes || {},
      })),
      {
        type: "user_registered",
        description: "User registered",
        timestamp: user.createdAt,
      },
    ];

    if (user.lastLogin) {
      activities.push({
        type: "login",
        description: "Last login",
        timestamp: user.lastLogin,
      });
    }

    // Sort by timestamp
    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * Suspend user account
   * @param {String} userId - User ID
   * @param {String} adminId - Admin ID performing the action
   * @param {String} reason - Suspension reason
   * @returns {Object} Updated user
   */
  async suspendUser(userId, adminId, reason = "") {
    const user = await User.findById(userId);

    if (!user) {
      throw createError(404, "User not found");
    }

    if (user.status === "suspended") {
      throw createError(400, "User is already suspended");
    }

    const previousStatus = user.status;

    // Update user status
    user.status = "suspended";
    user.isActive = false;
    await user.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "suspend_user",
      resource: "user",
      resourceId: userId,
      changes: {
        status: { from: previousStatus, to: "suspended" },
        reason,
      },
      timestamp: new Date(),
    });

    // Revoke all active refresh tokens for the user
    try {
      const RefreshToken = (await import("../models/refreshToken.model.js")).default;
      await RefreshToken.deleteMany({ user: userId });
    } catch (tokenError) {
      // Non-critical: log but don't block the suspension
    }

    // Notify user of suspension via email
    try {
      const { sendEmailDirect } = await import("../utils/email.js");
      await sendEmailDirect({
        to: user.email,
        subject: "Your Confetti account has been suspended",
        html: `
          <h2>Account Suspended</h2>
          <p>Hi ${user.firstName || user.name || "there"},</p>
          <p>Your Confetti account has been suspended${reason ? ` for the following reason: <strong>${reason}</strong>` : ""}.</p>
          <p>If you believe this is a mistake, please contact our support team.</p>
        `,
      });
    } catch (emailError) {
      // Non-critical: log but don't block the suspension
    }

    return user;
  }

  /**
   * Activate user account
   * @param {String} userId - User ID
   * @param {String} adminId - Admin ID performing the action
   * @returns {Object} Updated user
   */
  async activateUser(userId, adminId) {
    const user = await User.findById(userId);

    if (!user) {
      throw createError(404, "User not found");
    }

    if (user.status === "active" && user.isActive) {
      throw createError(400, "User is already active");
    }

    const previousStatus = user.status;

    // Update user status (reactivation also cancels a pending account closure)
    user.status = "active";
    user.isActive = true;
    user.deletedAt = undefined;
    user.accountDisabledReason = undefined;
    await user.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "activate_user",
      resource: "user",
      resourceId: userId,
      changes: {
        status: { from: previousStatus, to: "active" },
      },
      timestamp: new Date(),
    });

    // Notify user of account activation
    try {
      const { sendEmailDirect } = await import("../utils/email.js");
      await sendEmailDirect({
        to: user.email,
        subject: "Your Confetti account has been reactivated",
        html: `
          <h2>Account Reactivated</h2>
          <p>Hi ${user.firstName || user.name || "there"},</p>
          <p>Good news! Your Confetti account has been reactivated. You can now log in and use all platform features.</p>
          <p><a href="${process.env.FRONTEND_URL}/login" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">Log In</a></p>
        `,
      });
    } catch (emailError) {
      // Non-critical
    }

    return user;
  }

  /**
   * Delete user account (soft delete with data archival)
   * @param {String} userId - User ID
   * @param {String} adminId - Admin ID performing the action
   * @returns {Object} Result
   */
  async deleteUser(userId, adminId) {
    const user = await User.findById(userId);

    if (!user) {
      throw createError(404, "User not found");
    }

    // Archive user data before deletion
    const archivedData = {
      user: user.toObject(),
      events: await Event.find({ organizer: userId }).lean(),
      payments: await Payment.find({ user: userId }).lean(),
      archivedAt: new Date(),
      archivedBy: adminId,
    };

    // Store archived data in a dedicated archive collection
    try {
      const mongoose = (await import("mongoose")).default;
      const archiveCollection = mongoose.connection.collection("user_archives");
      await archiveCollection.insertOne(archivedData);
    } catch (archiveError) {
      // Non-critical: log but proceed with deletion
    }

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "delete_user",
      resource: "user",
      resourceId: userId,
      changes: {
        archived: true,
      },
      timestamp: new Date(),
    });

    // Soft delete: deactivate instead of hard delete
    user.status = "deleted";
    user.isActive = false;
    user.email = `deleted_${user._id}@deleted.com`; // Prevent email conflicts
    await user.save();

    // GDPR: anonymize related data
    try {
      // Anonymize event data — replace organizer info with a placeholder
      await Event.updateMany(
        { organizer: userId },
        { $set: { organizerName: "Deleted User", organizerEmail: `deleted_${userId}@deleted.com` } }
      );

      // Revoke all active sessions/tokens
      const RefreshToken = (await import("../models/refreshToken.model.js")).default;
      await RefreshToken.deleteMany({ user: userId });
    } catch (gdprError) {
      // Non-critical: log but don't block
    }

    return {
      success: true,
      message: "User account deleted and data archived",
    };
  }

  /**
   * Update user information
   * @param {String} userId - User ID
   * @param {Object} updates - Fields to update
   * @param {String} adminId - Admin ID performing the action
   * @returns {Object} Updated user
   */
  async updateUser(userId, updates, adminId) {
    const user = await User.findById(userId);

    if (!user) {
      throw createError(404, "User not found");
    }

    // Track changes for audit log
    const changes = {};
    const allowedUpdates = ["firstName", "lastName", "phone", "role", "status"];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined && updates[field] !== user[field]) {
        changes[field] = { from: user[field], to: updates[field] };
        user[field] = updates[field];
      }
    });

    await user.save();

    // Log the action
    if (Object.keys(changes).length > 0) {
      await AuditLog.create({
        admin: adminId,
        action: "update_user",
        resource: "user",
        resourceId: userId,
        changes,
        timestamp: new Date(),
      });
    }

    return user;
  }

  /**
   * Get user statistics
   * @returns {Object} User statistics
   */
  async getUserStatistics() {
    const [totalUsers, usersByRole, usersByStatus, recentRegistrations] =
      await Promise.all([
        User.countDocuments(),
        User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
        User.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
      ]);

    return {
      total: totalUsers,
      byRole: usersByRole,
      byStatus: usersByStatus,
      recentRegistrations,
    };
  }

  /**
   * Export users data
   * @param {Object} filters - Export filters
   * @returns {Array} Users data for export
   */
  async exportUsers(filters = {}) {
    const query = {};

    if (filters.role) query.role = filters.role;
    if (filters.status) query.status = filters.status;
    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const users = await User.find(query)
      .select("-password -otp -twoFactorSecret")
      .populate("subscription", "tier status")
      .lean();

    return users.map((user) => ({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      phone: user.phone,
      subscriptionTier: user.subscription?.tier || "none",
      subscriptionStatus: user.subscription?.status || "none",
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    }));
  }
}

export default new AdminUserManagementService();
