import SupportTicket from "../models/supportTicket.model.js";
import CannedResponse from "../models/cannedResponse.model.js";
import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";

/**
 * Admin Support Ticket Service
 * Handles support ticket management for admin dashboard
 */
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
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    let tickets;
    let total;

    if (search) {
      // Search by subject or user email
      const users = await User.find({
        $or: [
          { email: { $regex: search, $options: "i" } },
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const searchQuery = {
        $or: [
          { subject: { $regex: search, $options: "i" } },
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

    // TODO: Send notification to assigned admin

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

    // TODO: Send email notification to user

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

    // TODO: Send closure notification to user

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

    // TODO: Send escalation notification to senior admins

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
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
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
