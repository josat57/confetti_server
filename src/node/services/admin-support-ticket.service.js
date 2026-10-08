import SupportTicket from "../models/supportTicket.model.js";
import CannedResponse from "../models/cannedResponse.model.js";
import User from "../models/user.model.js";
import Admin from "../models/Admin.js";
import { escapeRegExp } from "../utils/escape-regex.js";

// Escape user-supplied values interpolated into HTML emails
const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";

/**
 * Admin Support Ticket Service
 * Handles support ticket management for admin dashboard
 */
/** The user's support page on the website */
const supportPage = (user) =>
  `${process.env.FRONTEND_URL}/${{ vendor: "vendor", "event-planner": "planner" }[user?.role] || "user"}/dashboard/support`;

class AdminSupportTicketService {
  /**
   * Get support tickets with pagination and filters
   * @param {Object} options - Query options
   * @returns {Object} Paginated tickets
   */
  async getTickets(options = {}) {
    const {
      page = 1,
      limit = 20,
      status = "",
      priority = "",
      category = "",
      assignedTo = "",
      escalated = "",
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Assigned to filter
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    // Escalated filter
    if (escalated === "true") {
      query.escalated = true;
    }

    const skip = (page - 1) * limit;
    // Default queue order: most urgent first (priority support tickets are "high"), then newest
    const sort =
      !options.sortBy || sortBy === "priority"
        ? { priorityRank: sortOrder === "asc" ? 1 : -1, createdAt: -1 }
        : { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    let tickets;
    let total;

    if (search) {
      // Search by subject or user email
      const users = await User.find({
        $or: [
          { email: { $regex: escapeRegExp(search), $options: "i" } },
          { firstName: { $regex: escapeRegExp(search), $options: "i" } },
          { lastName: { $regex: escapeRegExp(search), $options: "i" } },
        ],
      }).select("_id");

      const searchQuery = {
        $or: [
          { subject: { $regex: escapeRegExp(search), $options: "i" } },
          { user: { $in: users.map((u) => u._id) } },
        ],
      };

      const finalQuery = { ...query, ...searchQuery };

      [tickets, total] = await Promise.all([
        SupportTicket.find(finalQuery)
          .populate("user", "email firstName lastName")
          .populate("assignedTo", "email firstName lastName")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        SupportTicket.countDocuments(finalQuery),
      ]);
    } else {
      [tickets, total] = await Promise.all([
        SupportTicket.find(query)
          .populate("user", "email firstName lastName")
          .populate("assignedTo", "email firstName lastName")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        SupportTicket.countDocuments(query),
      ]);
    }

    return {
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get ticket by ID with full details
   * @param {String} ticketId - Ticket ID
   * @returns {Object} Ticket details
   */
  async getTicketById(ticketId) {
    const ticket = await SupportTicket.findById(ticketId)
      .populate("user", "email firstName lastName phone")
      .populate("assignedTo", "email firstName lastName")
      .populate("messages.sender")
      .populate("resolution.resolvedBy", "email firstName lastName")
      .populate("internalNotes.admin", "email firstName lastName")
      .populate("escalatedBy", "email firstName lastName")
      .lean();

    if (!ticket) {
      throw createError(404, "Ticket not found");
    }

    // Get user's other tickets
    const userTickets = await SupportTicket.find({
      user: ticket.user._id,
      _id: { $ne: ticketId },
    })
      .select("subject status priority createdAt")
      .sort("-createdAt")
      .limit(5)
      .lean();

    return {
      ...ticket,
      userTickets,
    };
  }

  /**
   * Assign ticket to admin
   * @param {String} ticketId - Ticket ID
   * @param {String} adminId - Admin ID to assign to
   * @param {String} assignedBy - Admin ID performing the action
   * @returns {Object} Updated ticket
   */
  async assignTicket(ticketId, adminId, assignedBy) {
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw createError(404, "Ticket not found");
    }

    const previousAssignee = ticket.assignedTo;

    await ticket.assignTo(adminId);

    // Log the action
    await AuditLog.create({
      admin: assignedBy,
      action: "assign_ticket",
      resource: "support_ticket",
      resourceId: ticketId,
      changes: {
        assignedTo: { from: previousAssignee, to: adminId },
        status: { from: ticket.status, to: "in_progress" },
      },
      timestamp: new Date(),
    });

    // Notify the assigned admin
    try {
      const assignedAdmin = await User.findById(adminId).select("email firstName name");
      if (assignedAdmin?.email) {
        const { sendEmailDirect } = await import("../utils/email.js");
        await sendEmailDirect({
          to: assignedAdmin.email,
          subject: `Support ticket assigned to you: #${ticket.ticketNumber || ticketId}`,
          html: `
            <h2>Support Ticket Assigned</h2>
            <p>Hi ${assignedAdmin.firstName || assignedAdmin.name || "there"},</p>
            <p>A support ticket has been assigned to you.</p>
            <table style="width:100%;border-collapse:collapse;margin:12px 0;">
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Ticket</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">#${ticket.ticketNumber || ticketId}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Subject</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${esc(ticket.subject || "N/A")}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Priority</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${ticket.priority}</td></tr>
            </table>
            <p><a href="${process.env.FRONTEND_URL}/admin/tickets/${ticketId}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">View Ticket</a></p>
          `,
        });
      }
    } catch (emailError) {
      // Non-critical
    }

    return ticket;
  }

  /**
   * Add response to ticket
   * @param {String} ticketId - Ticket ID
   * @param {String} adminId - Admin ID
   * @param {String} content - Response content
   * @param {Array} attachments - Attachments
   * @returns {Object} Updated ticket
   */
  async respondToTicket(ticketId, adminId, content, attachments = []) {
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw createError(404, "Ticket not found");
    }

    if (ticket.status === "closed") {
      throw createError(400, "Cannot respond to closed ticket");
    }

    await ticket.addMessage(adminId, "Admin", content, attachments);

    // Update admin response
    ticket.adminResponse = {
      content,
      respondedBy: adminId,
      respondedAt: new Date(),
    };

    await ticket.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "respond_to_ticket",
      resource: "support_ticket",
      resourceId: ticketId,
      changes: {
        messageAdded: true,
      },
      timestamp: new Date(),
    });

    // Email the ticket submitter with the admin response
    try {
      const ticketUser = await User.findById(ticket.user).select("email firstName name role");
      if (ticketUser?.email) {
        const { sendEmailDirect } = await import("../utils/email.js");
        await sendEmailDirect({
          to: ticketUser.email,
          subject: `Update on your support ticket #${ticket.ticketNumber || ticketId}`,
          html: `
            <h2>Support Ticket Update</h2>
            <p>Hi ${ticketUser.firstName || ticketUser.name || "there"},</p>
            <p>Your support ticket has received a response:</p>
            <blockquote style="border-left:4px solid #6366f1;padding:12px;margin:12px 0;background:#f5f3ff;white-space:pre-line;">
              ${String(content).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])}
            </blockquote>
            <p><a href="${supportPage(ticketUser)}?ticket=${ticketId}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">View Ticket</a></p>
          `,
        });
      }
    } catch (emailError) {
      // Non-critical
    }

    return ticket;
  }

  /**
   * Close ticket with resolution
   * @param {String} ticketId - Ticket ID
   * @param {String} adminId - Admin ID
   * @param {String} resolution - Resolution content
   * @returns {Object} Updated ticket
   */
  async closeTicket(ticketId, adminId, resolution) {
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw createError(404, "Ticket not found");
    }

    if (ticket.status === "closed") {
      throw createError(400, "Ticket is already closed");
    }

    const previousStatus = ticket.status;

    await ticket.resolve(adminId, resolution);
    await ticket.close();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "close_ticket",
      resource: "support_ticket",
      resourceId: ticketId,
      changes: {
        status: { from: previousStatus, to: "closed" },
        resolution,
      },
      timestamp: new Date(),
    });

    // Notify the user that their ticket has been closed
    try {
      const ticketUser = await User.findById(ticket.user).select("email firstName name role");
      if (ticketUser?.email) {
        const { sendEmailDirect } = await import("../utils/email.js");
        await sendEmailDirect({
          to: ticketUser.email,
          subject: `Your support ticket #${ticket.ticketNumber || ticketId} has been resolved`,
          html: `
            <h2>Support Ticket Closed</h2>
            <p>Hi ${ticketUser.firstName || ticketUser.name || "there"},</p>
            <p>Your support ticket has been resolved and closed.</p>
            ${resolution ? `<p><strong>Resolution:</strong> ${resolution}</p>` : ""}
            <p>If you need further assistance, please open a new ticket.</p>
            <p><a href="${supportPage(ticketUser)}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">Go to Support</a></p>
          `,
        });
      }
    } catch (emailError) {
      // Non-critical
    }

    return ticket;
  }

  /**
   * Escalate ticket
   * @param {String} ticketId - Ticket ID
   * @param {String} adminId - Admin ID
   * @param {String} reason - Escalation reason
   * @returns {Object} Updated ticket
   */
  async escalateTicket(ticketId, adminId, reason) {
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw createError(404, "Ticket not found");
    }

    if (ticket.escalated) {
      throw createError(400, "Ticket is already escalated");
    }

    const previousPriority = ticket.priority;

    await ticket.escalate(adminId, reason);

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "escalate_ticket",
      resource: "support_ticket",
      resourceId: ticketId,
      changes: {
        escalated: true,
        priority: { from: previousPriority, to: "urgent" },
        reason,
      },
      timestamp: new Date(),
    });

    // Notify senior admins of escalation
    try {
      // Admin accounts live in the Admin collection (not User)
      const seniorAdmins = await Admin.find({ role: "super_admin", isActive: true }).select("email firstName").lean();

      const { sendEmailDirect } = await import("../utils/email.js");
      for (const admin of seniorAdmins) {
        await sendEmailDirect({
          to: admin.email,
          subject: `Urgent: Support ticket escalated #${ticket.ticketNumber || ticketId}`,
          html: `
            <h2>Ticket Escalated</h2>
            <p>Hi ${admin.firstName || admin.name || "there"},</p>
            <p>A support ticket has been escalated and requires senior review.</p>
            <table style="width:100%;border-collapse:collapse;margin:12px 0;">
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Ticket</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">#${ticket.ticketNumber || ticketId}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Subject</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${esc(ticket.subject || "N/A")}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Escalation Reason</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${esc(reason)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Priority</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">Urgent</td></tr>
            </table>
            <p><a href="${process.env.FRONTEND_URL}/admin/tickets/${ticketId}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px;">Review Ticket</a></p>
          `,
        }).catch(() => {});
      }
    } catch (emailError) {
      // Non-critical
    }

    return ticket;
  }

  /**
   * Update ticket priority
   * @param {String} ticketId - Ticket ID
   * @param {String} priority - New priority
   * @param {String} adminId - Admin ID
   * @returns {Object} Updated ticket
   */
  async updatePriority(ticketId, priority, adminId) {
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw createError(404, "Ticket not found");
    }

    const previousPriority = ticket.priority;
    ticket.priority = priority;
    await ticket.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "update_ticket_priority",
      resource: "support_ticket",
      resourceId: ticketId,
      changes: {
        priority: { from: previousPriority, to: priority },
      },
      timestamp: new Date(),
    });

    return ticket;
  }

  /**
   * Add internal note to ticket
   * @param {String} ticketId - Ticket ID
   * @param {String} adminId - Admin ID
   * @param {String} note - Note content
   * @returns {Object} Updated ticket
   */
  async addInternalNote(ticketId, adminId, note) {
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw createError(404, "Ticket not found");
    }

    await ticket.addInternalNote(adminId, note);

    return ticket;
  }

  /**
   * Get ticket statistics
   * @returns {Object} Ticket statistics
   */
  async getTicketStatistics() {
    const [stats, avgResponseTime, avgResolutionTime, slaBreaches] =
      await Promise.all([
        SupportTicket.getStatistics(),
        this.calculateAverageResponseTime(),
        this.calculateAverageResolutionTime(),
        SupportTicket.countDocuments({ "sla.breached": true }),
      ]);

    return {
      ...stats,
      avgResponseTime,
      avgResolutionTime,
      slaBreaches,
    };
  }

  /**
   * Calculate average response time
   * @returns {Number} Average response time in hours
   */
  async calculateAverageResponseTime() {
    const tickets = await SupportTicket.find({
      "sla.firstResponseTime": { $exists: true },
    })
      .select("createdAt sla.firstResponseTime")
      .lean();

    if (tickets.length === 0) return 0;

    const totalTime = tickets.reduce((sum, ticket) => {
      const responseTime =
        new Date(ticket.sla.firstResponseTime) - new Date(ticket.createdAt);
      return sum + responseTime;
    }, 0);

    const avgMilliseconds = totalTime / tickets.length;
    return Math.round((avgMilliseconds / (1000 * 60 * 60)) * 100) / 100; // Convert to hours
  }

  /**
   * Calculate average resolution time
   * @returns {Number} Average resolution time in hours
   */
  async calculateAverageResolutionTime() {
    const tickets = await SupportTicket.find({
      "sla.resolutionTime": { $exists: true },
    })
      .select("createdAt sla.resolutionTime")
      .lean();

    if (tickets.length === 0) return 0;

    const totalTime = tickets.reduce((sum, ticket) => {
      const resolutionTime =
        new Date(ticket.sla.resolutionTime) - new Date(ticket.createdAt);
      return sum + resolutionTime;
    }, 0);

    const avgMilliseconds = totalTime / tickets.length;
    return Math.round((avgMilliseconds / (1000 * 60 * 60)) * 100) / 100; // Convert to hours
  }

  /**
   * Get canned responses
   * @param {Object} options - Query options
   * @returns {Object} Canned responses
   */
  async getCannedResponses(options = {}) {
    const { category = "", search = "" } = options;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: escapeRegExp(search), $options: "i" } },
        { content: { $regex: escapeRegExp(search), $options: "i" } },
        { tags: { $regex: escapeRegExp(search), $options: "i" } },
      ];
    }

    const responses = await CannedResponse.find(query)
      .populate("createdBy", "email firstName lastName")
      .sort("-usageCount")
      .lean();

    return responses;
  }

  /**
   * Create canned response
   * @param {Object} data - Canned response data
   * @param {String} adminId - Admin ID
   * @returns {Object} Created canned response
   */
  async createCannedResponse(data, adminId) {
    const response = await CannedResponse.create({
      ...data,
      createdBy: adminId,
    });

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "create_canned_response",
      resource: "canned_response",
      resourceId: response._id,
      changes: {
        created: true,
      },
      timestamp: new Date(),
    });

    return response;
  }

  /**
   * Update canned response
   * @param {String} responseId - Response ID
   * @param {Object} updates - Updates
   * @param {String} adminId - Admin ID
   * @returns {Object} Updated canned response
   */
  async updateCannedResponse(responseId, updates, adminId) {
    const response = await CannedResponse.findByIdAndUpdate(
      responseId,
      updates,
      { new: true }
    );

    if (!response) {
      throw createError(404, "Canned response not found");
    }

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "update_canned_response",
      resource: "canned_response",
      resourceId: responseId,
      changes: updates,
      timestamp: new Date(),
    });

    return response;
  }

  /**
   * Delete canned response
   * @param {String} responseId - Response ID
   * @param {String} adminId - Admin ID
   * @returns {Object} Result
   */
  async deleteCannedResponse(responseId, adminId) {
    const response = await CannedResponse.findByIdAndUpdate(
      responseId,
      { isActive: false },
      { new: true }
    );

    if (!response) {
      throw createError(404, "Canned response not found");
    }

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "delete_canned_response",
      resource: "canned_response",
      resourceId: responseId,
      changes: {
        isActive: false,
      },
      timestamp: new Date(),
    });

    return { success: true, message: "Canned response deleted" };
  }

  /**
   * Use canned response
   * @param {String} responseId - Response ID
   * @returns {Object} Canned response
   */
  async useCannedResponse(responseId) {
    const response = await CannedResponse.findById(responseId);

    if (!response) {
      throw createError(404, "Canned response not found");
    }

    await response.incrementUsage();

    return response;
  }

  /**
   * Export tickets
   * @param {Object} filters - Export filters
   * @returns {Array} Tickets data
   */
  async exportTickets(filters = {}) {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.category) query.category = filters.category;
    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const tickets = await SupportTicket.find(query)
      .populate("user", "email firstName lastName")
      .populate("assignedTo", "email firstName lastName")
      .sort("-createdAt")
      .lean();

    return tickets.map((ticket) => ({
      id: ticket._id,
      subject: ticket.subject,
      userEmail: ticket.user?.email,
      userName: `${ticket.user?.firstName} ${ticket.user?.lastName}`,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedTo: ticket.assignedTo?.email,
      escalated: ticket.escalated,
      satisfactionRating: ticket.satisfaction?.rating,
      createdAt: ticket.createdAt,
      resolvedAt: ticket.resolution?.resolvedAt,
    }));
  }
}

export default new AdminSupportTicketService();
