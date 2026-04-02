import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import FlaggedContent from "../models/flaggedContent.model.js";
import Notification from "../models/notification.model.js";
import SupportTicket from "../models/supportTicket.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";

class AdminBulkOperationsService {
  // ==================== Bulk User Operations ====================

  async bulkUpdateUserStatus(data, adminId) {
    const { userIds, status, reason } = data;

    if (!userIds || userIds.length === 0) {
      throw createError("No users selected", 400);
    }

    if (userIds.length > 100) {
      throw createError("Maximum 100 users can be updated at once", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          results.failed.push({ userId, reason: "User not found" });
          continue;
        }

        const oldStatus = user.status;
        user.status = status;
        await user.save();

        results.successful.push({ userId, oldStatus, newStatus: status });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_update_user_status",
          resource: "User",
          resourceId: userId,
          details: { oldStatus, newStatus: status, reason },
        });
      } catch (error) {
        results.failed.push({ userId, reason: error.message });
      }
    }

    return {
      total: userIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkDeleteUsers(data, adminId) {
    const { userIds, reason } = data;

    if (!userIds || userIds.length === 0) {
      throw createError("No users selected", 400);
    }

    if (userIds.length > 50) {
      throw createError("Maximum 50 users can be deleted at once", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          results.failed.push({ userId, reason: "User not found" });
          continue;
        }

        // Archive user data before deletion
        const archivedData = {
          ...user.toObject(),
          deletedAt: new Date(),
          deletedBy: adminId,
          deletionReason: reason,
        };

        // Soft delete
        user.status = "deleted";
        user.email = `deleted_${Date.now()}_${user.email}`;
        await user.save();

        results.successful.push({ userId, email: user.email });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_delete_user",
          resource: "User",
          resourceId: userId,
          details: { reason, archived: true },
        });
      } catch (error) {
        results.failed.push({ userId, reason: error.message });
      }
    }

    return {
      total: userIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkExportUsers(data, adminId) {
    const { userIds, format = "csv", fields } = data;

    if (!userIds || userIds.length === 0) {
      throw createError("No users selected", 400);
    }

    const users = await User.find({ _id: { $in: userIds } })
      .select(fields || "-password")
      .lean();

    // In production, this would generate actual file
    const exportData = {
      format,
      recordCount: users.length,
      downloadUrl: `/exports/users-bulk-${Date.now()}.${format}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "bulk_export_users",
      resource: "User",
      details: { count: users.length, format },
    });

    return exportData;
  }

  async bulkAssignRole(data, adminId) {
    const { userIds, role } = data;

    if (!userIds || userIds.length === 0) {
      throw createError("No users selected", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          results.failed.push({ userId, reason: "User not found" });
          continue;
        }

        const oldRole = user.role;
        user.role = role;
        await user.save();

        results.successful.push({ userId, oldRole, newRole: role });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_assign_role",
          resource: "User",
          resourceId: userId,
          details: { oldRole, newRole: role },
        });
      } catch (error) {
        results.failed.push({ userId, reason: error.message });
      }
    }

    return {
      total: userIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  // ==================== Bulk Vendor Operations ====================

  async bulkApproveVendors(data, adminId) {
    const { vendorIds } = data;

    if (!vendorIds || vendorIds.length === 0) {
      throw createError("No vendors selected", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const vendorId of vendorIds) {
      try {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
          results.failed.push({ vendorId, reason: "Vendor not found" });
          continue;
        }

        vendor.verificationStatus = "verified";
        vendor.isVerified = true;
        vendor.status = "approved";
        vendor.verifiedAt = new Date();
        await vendor.save();

        results.successful.push({ vendorId, name: vendor.name });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_approve_vendor",
          resource: "Vendor",
          resourceId: vendorId,
        });
      } catch (error) {
        results.failed.push({ vendorId, reason: error.message });
      }
    }

    return {
      total: vendorIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkRejectVendors(data, adminId) {
    const { vendorIds, reason } = data;

    if (!vendorIds || vendorIds.length === 0) {
      throw createError("No vendors selected", 400);
    }

    if (!reason) {
      throw createError("Rejection reason is required", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const vendorId of vendorIds) {
      try {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
          results.failed.push({ vendorId, reason: "Vendor not found" });
          continue;
        }

        vendor.verificationStatus = "rejected";
        vendor.status = "rejected";
        vendor.rejectionReason = reason;
        await vendor.save();

        results.successful.push({ vendorId, name: vendor.name });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_reject_vendor",
          resource: "Vendor",
          resourceId: vendorId,
          details: { reason },
        });
      } catch (error) {
        results.failed.push({ vendorId, reason: error.message });
      }
    }

    return {
      total: vendorIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkSuspendVendors(data, adminId) {
    const { vendorIds, reason } = data;

    if (!vendorIds || vendorIds.length === 0) {
      throw createError("No vendors selected", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const vendorId of vendorIds) {
      try {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
          results.failed.push({ vendorId, reason: "Vendor not found" });
          continue;
        }

        vendor.status = "suspended";
        vendor.suspensionReason = reason;
        vendor.suspendedAt = new Date();
        await vendor.save();

        results.successful.push({ vendorId, name: vendor.name });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_suspend_vendor",
          resource: "Vendor",
          resourceId: vendorId,
          details: { reason },
        });
      } catch (error) {
        results.failed.push({ vendorId, reason: error.message });
      }
    }

    return {
      total: vendorIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkUpdateVendorCategory(data, adminId) {
    const { vendorIds, category } = data;

    if (!vendorIds || vendorIds.length === 0) {
      throw createError("No vendors selected", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const vendorId of vendorIds) {
      try {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
          results.failed.push({ vendorId, reason: "Vendor not found" });
          continue;
        }

        const oldCategory = vendor.category;
        vendor.category = category;
        await vendor.save();

        results.successful.push({
          vendorId,
          oldCategory,
          newCategory: category,
        });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_update_vendor_category",
          resource: "Vendor",
          resourceId: vendorId,
          details: { oldCategory, newCategory: category },
        });
      } catch (error) {
        results.failed.push({ vendorId, reason: error.message });
      }
    }

    return {
      total: vendorIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  // ==================== Bulk Content Moderation ====================

  async bulkApproveContent(data, adminId) {
    const { contentIds, notes } = data;

    if (!contentIds || contentIds.length === 0) {
      throw createError("No content selected", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const contentId of contentIds) {
      try {
        const flaggedContent = await FlaggedContent.findById(contentId);
        if (!flaggedContent) {
          results.failed.push({ contentId, reason: "Content not found" });
          continue;
        }

        flaggedContent.status = "resolved";
        flaggedContent.action = "none";
        flaggedContent.reviewedBy = adminId;
        flaggedContent.reviewedAt = new Date();
        flaggedContent.notes = notes;
        await flaggedContent.save();

        results.successful.push({ contentId });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_approve_content",
          resource: "FlaggedContent",
          resourceId: contentId,
          details: { notes },
        });
      } catch (error) {
        results.failed.push({ contentId, reason: error.message });
      }
    }

    return {
      total: contentIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkRemoveContent(data, adminId) {
    const { contentIds, reason } = data;

    if (!contentIds || contentIds.length === 0) {
      throw createError("No content selected", 400);
    }

    if (!reason) {
      throw createError("Removal reason is required", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const contentId of contentIds) {
      try {
        const flaggedContent = await FlaggedContent.findById(contentId);
        if (!flaggedContent) {
          results.failed.push({ contentId, reason: "Content not found" });
          continue;
        }

        flaggedContent.status = "resolved";
        flaggedContent.action = "content_removed";
        flaggedContent.reviewedBy = adminId;
        flaggedContent.reviewedAt = new Date();
        flaggedContent.actionReason = reason;
        await flaggedContent.save();

        results.successful.push({ contentId });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_remove_content",
          resource: "FlaggedContent",
          resourceId: contentId,
          details: { reason },
        });
      } catch (error) {
        results.failed.push({ contentId, reason: error.message });
      }
    }

    return {
      total: contentIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkDismissContent(data, adminId) {
    const { contentIds } = data;

    if (!contentIds || contentIds.length === 0) {
      throw createError("No content selected", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const contentId of contentIds) {
      try {
        const flaggedContent = await FlaggedContent.findById(contentId);
        if (!flaggedContent) {
          results.failed.push({ contentId, reason: "Content not found" });
          continue;
        }

        flaggedContent.status = "dismissed";
        flaggedContent.reviewedBy = adminId;
        flaggedContent.reviewedAt = new Date();
        await flaggedContent.save();

        results.successful.push({ contentId });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_dismiss_content",
          resource: "FlaggedContent",
          resourceId: contentId,
        });
      } catch (error) {
        results.failed.push({ contentId, reason: error.message });
      }
    }

    return {
      total: contentIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  // ==================== Bulk Notification Operations ====================

  async bulkSendNotifications(data, adminId) {
    const {
      recipients,
      type,
      category,
      title,
      message,
      priority,
      actionUrl,
      actionText,
    } = data;

    if (!recipients || recipients.length === 0) {
      throw createError("No recipients selected", 400);
    }

    if (recipients.length > 1000) {
      throw createError("Maximum 1000 recipients allowed per bulk send", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const recipientId of recipients) {
      try {
        const notification = await Notification.create({
          recipient: recipientId,
          type,
          category,
          title,
          message,
          priority,
          actionUrl,
          actionText,
          status: "pending",
        });

        results.successful.push({
          recipientId,
          notificationId: notification._id,
        });
      } catch (error) {
        results.failed.push({ recipientId, reason: error.message });
      }
    }

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "bulk_send_notifications",
      resource: "Notification",
      details: {
        recipientCount: recipients.length,
        successful: results.successful.length,
        failed: results.failed.length,
        type,
        category,
      },
    });

    return {
      total: recipients.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkDeleteNotifications(data, adminId) {
    const { notificationIds } = data;

    if (!notificationIds || notificationIds.length === 0) {
      throw createError("No notifications selected", 400);
    }

    const result = await Notification.deleteMany({
      _id: { $in: notificationIds },
    });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "bulk_delete_notifications",
      resource: "Notification",
      details: { count: result.deletedCount },
    });

    return {
      total: notificationIds.length,
      deleted: result.deletedCount,
    };
  }

  // ==================== Bulk Ticket Operations ====================

  async bulkAssignTickets(data, adminId) {
    const { ticketIds, assignTo } = data;

    if (!ticketIds || ticketIds.length === 0) {
      throw createError("No tickets selected", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const ticketId of ticketIds) {
      try {
        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
          results.failed.push({ ticketId, reason: "Ticket not found" });
          continue;
        }

        ticket.assignedTo = assignTo;
        ticket.status = "in_progress";
        await ticket.save();

        results.successful.push({ ticketId });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_assign_ticket",
          resource: "SupportTicket",
          resourceId: ticketId,
          details: { assignedTo: assignTo },
        });
      } catch (error) {
        results.failed.push({ ticketId, reason: error.message });
      }
    }

    return {
      total: ticketIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkCloseTickets(data, adminId) {
    const { ticketIds, resolution } = data;

    if (!ticketIds || ticketIds.length === 0) {
      throw createError("No tickets selected", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const ticketId of ticketIds) {
      try {
        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
          results.failed.push({ ticketId, reason: "Ticket not found" });
          continue;
        }

        ticket.status = "closed";
        ticket.resolution = resolution;
        ticket.closedAt = new Date();
        await ticket.save();

        results.successful.push({ ticketId });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_close_ticket",
          resource: "SupportTicket",
          resourceId: ticketId,
          details: { resolution },
        });
      } catch (error) {
        results.failed.push({ ticketId, reason: error.message });
      }
    }

    return {
      total: ticketIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }

  async bulkUpdateTicketPriority(data, adminId) {
    const { ticketIds, priority } = data;

    if (!ticketIds || ticketIds.length === 0) {
      throw createError("No tickets selected", 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const ticketId of ticketIds) {
      try {
        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
          results.failed.push({ ticketId, reason: "Ticket not found" });
          continue;
        }

        const oldPriority = ticket.priority;
        ticket.priority = priority;
        await ticket.save();

        results.successful.push({
          ticketId,
          oldPriority,
          newPriority: priority,
        });

        // Audit log
        await AuditLog.create({
          admin: adminId,
          action: "bulk_update_ticket_priority",
          resource: "SupportTicket",
          resourceId: ticketId,
          details: { oldPriority, newPriority: priority },
        });
      } catch (error) {
        results.failed.push({ ticketId, reason: error.message });
      }
    }

    return {
      total: ticketIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results,
    };
  }
}

export default new AdminBulkOperationsService();
