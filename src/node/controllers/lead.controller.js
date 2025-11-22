import Lead from "../models/lead.model.js";
import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Get all leads
 * GET /api/v1/vendors/leads
 */
export const getLeads = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const {
      status,
      priority,
      source,
      assignedTo,
      search,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    // Build query
    const query = { vendor: vendor._id };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (source) query.source = source;
    if (assignedTo) query.assignedTo = assignedTo;

    // Search in customer name, email, or event type
    if (search) {
      query.$or = [
        { "customer.name": new RegExp(search, "i") },
        { "customer.email": new RegExp(search, "i") },
        { "eventDetails.type": new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const leads = await Lead.find(query)
      .populate("assignedTo", "name email")
      .populate("quote", "quoteNumber total status")
      .populate("booking", "eventDate status")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Lead.countDocuments(query);

    // Get status counts
    const statusCounts = await Lead.aggregate([
      { $match: { vendor: vendor._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = {
      new: 0,
      contacted: 0,
      quoted: 0,
      negotiating: 0,
      won: 0,
      lost: 0,
    };

    statusCounts.forEach((item) => {
      counts[item._id] = item.count;
    });

    res.status(200).json({
      status: "success",
      results: leads.length,
      data: {
        leads,
        counts,
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

/**
 * Get single lead
 * GET /api/v1/vendors/leads/:id
 */
export const getLead = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const lead = await Lead.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    })
      .populate("assignedTo", "name email phone")
      .populate("quote", "quoteNumber total status items")
      .populate("booking", "eventDate status totalAmount")
      .populate("notes.createdBy", "name email");

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { lead },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create lead
 * POST /api/v1/vendors/leads
 */
export const createLead = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const leadData = {
      ...req.body,
      vendor: vendor._id,
    };

    const lead = await Lead.create(leadData);

    // Add initial note if provided
    if (req.body.initialNote) {
      await lead.addNote(req.body.initialNote, req.user._id);
    }

    await lead.populate("assignedTo", "name email");

    res.status(201).json({
      status: "success",
      message: "Lead created successfully",
      data: { lead },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update lead
 * PUT /api/v1/vendors/leads/:id
 */
export const updateLead = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const lead = await Lead.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    // Update allowed fields
    const allowedFields = [
      "customer",
      "eventDetails",
      "priority",
      "estimatedValue",
      "tags",
      "customFields",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        lead[field] = req.body[field];
      }
    });

    await lead.save();
    await lead.populate("assignedTo", "name email");

    res.status(200).json({
      status: "success",
      message: "Lead updated successfully",
      data: { lead },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update lead status
 * PUT /api/v1/vendors/leads/:id/status
 */
export const updateLeadStatus = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { status, note } = req.body;

    if (!status) {
      return next(new AppError("Status is required", 400));
    }

    const lead = await Lead.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    await lead.updateStatus(status, req.user._id, note);
    await lead.populate("assignedTo", "name email");

    res.status(200).json({
      status: "success",
      message: "Lead status updated successfully",
      data: { lead },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add note to lead
 * POST /api/v1/vendors/leads/:id/notes
 */
export const addNote = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { text, isPrivate } = req.body;

    if (!text) {
      return next(new AppError("Note text is required", 400));
    }

    const lead = await Lead.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    await lead.addNote(text, req.user._id, isPrivate);
    await lead.populate("notes.createdBy", "name email");

    res.status(200).json({
      status: "success",
      message: "Note added successfully",
      data: {
        notes: lead.notes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign lead
 * PUT /api/v1/vendors/leads/:id/assign
 */
export const assignLead = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { userId } = req.body;

    if (!userId) {
      return next(new AppError("User ID is required", 400));
    }

    const lead = await Lead.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    await lead.assign(userId);
    await lead.populate("assignedTo", "name email");

    res.status(200).json({
      status: "success",
      message: "Lead assigned successfully",
      data: { lead },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set follow-up date
 * PUT /api/v1/vendors/leads/:id/followup
 */
export const setFollowUp = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { date, note } = req.body;

    if (!date) {
      return next(new AppError("Follow-up date is required", 400));
    }

    const lead = await Lead.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    await lead.setFollowUp(new Date(date), req.user._id, note);

    res.status(200).json({
      status: "success",
      message: "Follow-up date set successfully",
      data: { lead },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark lead as won
 * POST /api/v1/vendors/leads/:id/won
 */
export const markAsWon = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { bookingId } = req.body;

    const lead = await Lead.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    await lead.markAsWon(bookingId, req.user._id);

    res.status(200).json({
      status: "success",
      message: "Lead marked as won",
      data: { lead },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark lead as lost
 * POST /api/v1/vendors/leads/:id/lost
 */
export const markAsLost = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { reason } = req.body;

    if (!reason) {
      return next(new AppError("Reason is required", 400));
    }

    const lead = await Lead.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    await lead.markAsLost(reason, req.user._id);

    res.status(200).json({
      status: "success",
      message: "Lead marked as lost",
      data: { lead },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete lead
 * DELETE /api/v1/vendors/leads/:id
 */
export const deleteLead = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const lead = await Lead.findOneAndDelete({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!lead) {
      return next(new AppError("Lead not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Lead deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get lead statistics
 * GET /api/v1/vendors/leads/stats
 */
export const getLeadStats = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { startDate, endDate } = req.query;

    const stats = await Lead.getStatistics(
      vendor._id,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    // Get conversion rate
    const conversionRate = await Lead.getConversionRate(vendor._id);

    // Get leads needing follow-up
    const needingFollowUp = await Lead.getNeedingFollowUp(vendor._id);

    // Get overdue leads
    const overdue = await Lead.getOverdue(vendor._id);

    res.status(200).json({
      status: "success",
      data: {
        stats: {
          ...stats,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
        needingFollowUp: needingFollowUp.length,
        overdue: overdue.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leads needing follow-up
 * GET /api/v1/vendors/leads/followup
 */
export const getFollowUpLeads = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const leads = await Lead.getNeedingFollowUp(vendor._id);

    res.status(200).json({
      status: "success",
      results: leads.length,
      data: { leads },
    });
  } catch (error) {
    next(error);
  }
};
