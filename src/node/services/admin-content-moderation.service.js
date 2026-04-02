import FlaggedContent from "../models/flaggedContent.model.js";
import Content from "../models/content.model.js";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import Event from "../models/event.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";

/**
 * Admin Content Moderation Service
 * Handles content moderation and flagged content management
 */
class AdminContentModerationService {
  /**
   * Get flagged content with pagination and filters
   * @param {Object} options - Query options
   * @returns {Object} Paginated flagged content
   */
  async getFlaggedContent(options = {}) {
    const {
      page = 1,
      limit = 20,
      contentType = "",
      status = "",
      priority = "",
      reason = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const query = {};

    // Content type filter
    if (contentType) {
      query.contentType = contentType;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Reason filter
    if (reason) {
      query.reason = reason;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [flaggedItems, total] = await Promise.all([
      FlaggedContent.find(query)
        .populate("reportedBy", "email firstName lastName")
        .populate("contentOwnerId", "email firstName lastName")
        .populate("reviewedBy", "email firstName lastName")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      FlaggedContent.countDocuments(query),
    ]);

    // Fetch actual content for each flagged item
    const enrichedItems = await Promise.all(
      flaggedItems.map(async (item) => {
        const content = await this.getContentByTypeAndId(
          item.contentType,
          item.contentId
        );
        return {
          ...item,
          contentData: content,
        };
      })
    );

    return {
      flaggedContent: enrichedItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get flagged content by ID with full details
   * @param {String} flaggedContentId - Flagged content ID
   * @returns {Object} Flagged content details
   */
  async getFlaggedContentById(flaggedContentId) {
    const flaggedItem = await FlaggedContent.findById(flaggedContentId)
      .populate("reportedBy", "email firstName lastName phone")
      .populate("contentOwnerId", "email firstName lastName phone status")
      .populate("reviewedBy", "email firstName lastName")
      .lean();

    if (!flaggedItem) {
      throw createError(404, "Flagged content not found");
    }

    // Get the actual content
    const content = await this.getContentByTypeAndId(
      flaggedItem.contentType,
      flaggedItem.contentId
    );

    // Get related reports for the same content
    const relatedReports = await FlaggedContent.find({
      contentId: flaggedItem.contentId,
      contentType: flaggedItem.contentType,
      _id: { $ne: flaggedContentId },
    })
      .populate("reportedBy", "email firstName lastName")
      .sort("-createdAt")
      .limit(10)
      .lean();

    // Get reporter's history
    const reporterHistory = await FlaggedContent.find({
      reportedBy: flaggedItem.reportedBy,
    })
      .select("contentType reason status createdAt")
      .sort("-createdAt")
      .limit(10)
      .lean();

    // Get content owner's moderation history
    const ownerHistory = await FlaggedContent.find({
      contentOwnerId: flaggedItem.contentOwnerId,
      status: { $in: ["resolved", "dismissed"] },
    })
      .select("contentType action status createdAt")
      .sort("-createdAt")
      .limit(10)
      .lean();

    return {
      ...flaggedItem,
      contentData: content,
      relatedReports,
      reporterHistory,
      ownerHistory,
    };
  }

  /**
   * Get content by type and ID
   * @param {String} contentType - Type of content
   * @param {String} contentId - Content ID
   * @returns {Object} Content data
   */
  async getContentByTypeAndId(contentType, contentId) {
    let content = null;

    try {
      switch (contentType) {
        case "profile":
          content = await User.findById(contentId)
            .select("-password -otp -twoFactorSecret")
            .lean();
          break;
        case "vendor":
          content = await Vendor.findById(contentId).lean();
          break;
        case "event":
          content = await Event.findById(contentId)
            .populate("organizer", "email firstName lastName")
            .lean();
          break;
        case "post":
        case "review":
          content = await Content.findById(contentId)
            .populate("author", "email firstName lastName")
            .lean();
          break;
        default:
          content = { id: contentId, type: contentType, data: "Unknown type" };
      }
    } catch (error) {
      content = { id: contentId, type: contentType, error: error.message };
    }

    return content;
  }

  /**
   * Approve flagged content (dismiss report)
   * @param {String} flaggedContentId - Flagged content ID
   * @param {String} adminId - Admin ID
   * @param {String} notes - Review notes
   * @returns {Object} Updated flagged content
   */
  async approveContent(flaggedContentId, adminId, notes = "") {
    const flaggedItem = await FlaggedContent.findById(flaggedContentId);

    if (!flaggedItem) {
      throw createError(404, "Flagged content not found");
    }

    if (
      flaggedItem.status === "resolved" ||
      flaggedItem.status === "dismissed"
    ) {
      throw createError(400, "This report has already been reviewed");
    }

    // Dismiss the report
    await flaggedItem.dismiss(adminId, notes);

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "approve_flagged_content",
      resource: "flagged_content",
      resourceId: flaggedContentId,
      changes: {
        status: { from: "pending", to: "dismissed" },
        action: "none",
        notes,
      },
      timestamp: new Date(),
    });

    // TODO: Send notification to reporter

    return flaggedItem;
  }

  /**
   * Remove flagged content
   * @param {String} flaggedContentId - Flagged content ID
   * @param {String} adminId - Admin ID
   * @param {String} reason - Removal reason
   * @returns {Object} Updated flagged content
   */
  async removeContent(flaggedContentId, adminId, reason) {
    const flaggedItem = await FlaggedContent.findById(flaggedContentId);

    if (!flaggedItem) {
      throw createError(404, "Flagged content not found");
    }

    if (!reason || reason.trim().length === 0) {
      throw createError(400, "Removal reason is required");
    }

    // Mark the actual content as removed/hidden
    await this.hideContent(
      flaggedItem.contentType,
      flaggedItem.contentId,
      adminId,
      reason
    );

    // Resolve the report
    await flaggedItem.resolve(adminId, "content_removed", reason);

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "remove_flagged_content",
      resource: "flagged_content",
      resourceId: flaggedContentId,
      changes: {
        status: { from: flaggedItem.status, to: "resolved" },
        action: "content_removed",
        reason,
      },
      timestamp: new Date(),
    });

    // TODO: Send notification to content owner
    // TODO: Send notification to reporter

    return flaggedItem;
  }

  /**
   * Hide/remove content based on type
   * @param {String} contentType - Type of content
   * @param {String} contentId - Content ID
   * @param {String} adminId - Admin ID
   * @param {String} reason - Removal reason
   */
  async hideContent(contentType, contentId, adminId, reason) {
    switch (contentType) {
      case "profile":
        await User.findByIdAndUpdate(contentId, {
          status: "suspended",
          isActive: false,
        });
        break;
      case "vendor":
        await Vendor.findByIdAndUpdate(contentId, {
          status: "suspended",
          isActive: false,
        });
        break;
      case "event":
        await Event.findByIdAndUpdate(contentId, {
          status: "cancelled",
        });
        break;
      case "post":
      case "review":
        await Content.findByIdAndUpdate(contentId, {
          status: "archived",
          moderationStatus: "rejected",
          moderationReason: reason,
          moderatedBy: adminId,
          moderatedAt: new Date(),
        });
        break;
      default:
        throw createError(400, `Cannot hide content of type: ${contentType}`);
    }
  }

  /**
   * Ban user who owns the flagged content
   * @param {String} flaggedContentId - Flagged content ID
   * @param {String} adminId - Admin ID
   * @param {String} reason - Ban reason
   * @returns {Object} Updated flagged content
   */
  async banUser(flaggedContentId, adminId, reason) {
    const flaggedItem = await FlaggedContent.findById(flaggedContentId);

    if (!flaggedItem) {
      throw createError(404, "Flagged content not found");
    }

    if (!reason || reason.trim().length === 0) {
      throw createError(400, "Ban reason is required");
    }

    // Ban the user
    const user = await User.findById(flaggedItem.contentOwnerId);
    if (!user) {
      throw createError(404, "Content owner not found");
    }

    user.status = "suspended";
    user.isActive = false;
    await user.save();

    // Resolve the report
    await flaggedItem.resolve(adminId, "user_banned", reason);

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "ban_user_from_flagged_content",
      resource: "user",
      resourceId: flaggedItem.contentOwnerId,
      changes: {
        status: { to: "suspended" },
        isActive: { to: false },
        reason,
      },
      timestamp: new Date(),
    });

    // TODO: Revoke all active sessions
    // TODO: Send notification to user
    // TODO: Send notification to reporter

    return flaggedItem;
  }

  /**
   * Send warning to content owner
   * @param {String} flaggedContentId - Flagged content ID
   * @param {String} adminId - Admin ID
   * @param {String} warningMessage - Warning message
   * @returns {Object} Updated flagged content
   */
  async sendWarning(flaggedContentId, adminId, warningMessage) {
    const flaggedItem = await FlaggedContent.findById(flaggedContentId);

    if (!flaggedItem) {
      throw createError(404, "Flagged content not found");
    }

    // Resolve the report with warning action
    await flaggedItem.resolve(adminId, "warning_sent", warningMessage);

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "send_warning_flagged_content",
      resource: "flagged_content",
      resourceId: flaggedContentId,
      changes: {
        action: "warning_sent",
        message: warningMessage,
      },
      timestamp: new Date(),
    });

    // TODO: Send warning notification to content owner

    return flaggedItem;
  }

  /**
   * Get moderation history for a user
   * @param {String} userId - User ID
   * @param {Number} limit - Number of records to return
   * @returns {Array} Moderation history
   */
  async getModerationHistory(userId, limit = 50) {
    const history = await FlaggedContent.find({
      contentOwnerId: userId,
    })
      .populate("reportedBy", "email firstName lastName")
      .populate("reviewedBy", "email firstName lastName")
      .sort("-createdAt")
      .limit(limit)
      .lean();

    return history;
  }

  /**
   * Get moderation statistics
   * @returns {Object} Moderation statistics
   */
  async getModerationStatistics() {
    const [stats, recentActivity] = await Promise.all([
      FlaggedContent.getStatistics(),
      FlaggedContent.find({ status: "pending" })
        .sort("-priority -createdAt")
        .limit(10)
        .populate("reportedBy", "email firstName lastName")
        .populate("contentOwnerId", "email firstName lastName")
        .lean(),
    ]);

    return {
      statistics: stats,
      recentActivity,
    };
  }

  /**
   * Bulk action on flagged content
   * @param {Array} flaggedContentIds - Array of flagged content IDs
   * @param {String} action - Action to perform
   * @param {String} adminId - Admin ID
   * @param {Object} options - Additional options
   * @returns {Object} Bulk action result
   */
  async bulkAction(flaggedContentIds, action, adminId, options = {}) {
    const results = {
      success: [],
      failed: [],
    };

    for (const id of flaggedContentIds) {
      try {
        let result;
        switch (action) {
          case "approve":
            result = await this.approveContent(id, adminId, options.notes);
            break;
          case "remove":
            result = await this.removeContent(id, adminId, options.reason);
            break;
          case "dismiss":
            result = await this.approveContent(id, adminId, options.notes);
            break;
          default:
            throw createError(400, `Invalid action: ${action}`);
        }
        results.success.push({ id, result });
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Update flagged content priority
   * @param {String} flaggedContentId - Flagged content ID
   * @param {String} priority - New priority
   * @param {String} adminId - Admin ID
   * @returns {Object} Updated flagged content
   */
  async updatePriority(flaggedContentId, priority, adminId) {
    const flaggedItem = await FlaggedContent.findById(flaggedContentId);

    if (!flaggedItem) {
      throw createError(404, "Flagged content not found");
    }

    const oldPriority = flaggedItem.priority;
    flaggedItem.priority = priority;
    await flaggedItem.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "update_flagged_content_priority",
      resource: "flagged_content",
      resourceId: flaggedContentId,
      changes: {
        priority: { from: oldPriority, to: priority },
      },
      timestamp: new Date(),
    });

    return flaggedItem;
  }

  /**
   * Assign flagged content to admin for review
   * @param {String} flaggedContentId - Flagged content ID
   * @param {String} adminId - Admin ID to assign to
   * @returns {Object} Updated flagged content
   */
  async assignToAdmin(flaggedContentId, adminId) {
    const flaggedItem = await FlaggedContent.findById(flaggedContentId);

    if (!flaggedItem) {
      throw createError(404, "Flagged content not found");
    }

    await flaggedItem.markUnderReview(adminId);

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "assign_flagged_content",
      resource: "flagged_content",
      resourceId: flaggedContentId,
      changes: {
        status: { from: flaggedItem.status, to: "under_review" },
        assignedTo: adminId,
      },
      timestamp: new Date(),
    });

    return flaggedItem;
  }

  /**
   * Export flagged content data
   * @param {Object} filters - Export filters
   * @returns {Array} Flagged content data for export
   */
  async exportFlaggedContent(filters = {}) {
    const query = {};

    if (filters.contentType) query.contentType = filters.contentType;
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const flaggedItems = await FlaggedContent.find(query)
      .populate("reportedBy", "email firstName lastName")
      .populate("contentOwnerId", "email firstName lastName")
      .populate("reviewedBy", "email firstName lastName")
      .lean();

    return flaggedItems.map((item) => ({
      id: item._id,
      contentType: item.contentType,
      contentId: item.contentId,
      reason: item.reason,
      description: item.description,
      status: item.status,
      priority: item.priority,
      action: item.action,
      reportedBy: item.reportedBy?.email,
      contentOwner: item.contentOwnerId?.email,
      reviewedBy: item.reviewedBy?.email,
      createdAt: item.createdAt,
      reviewedAt: item.reviewedAt,
    }));
  }
}

export default new AdminContentModerationService();
