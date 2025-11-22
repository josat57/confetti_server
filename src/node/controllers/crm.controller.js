import Client from "../models/client.model.js";
import Vendor from "../models/vendor.model.js";
import Booking from "../models/booking.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * Get all clients
 * GET /api/v1/vendors/clients
 */
export const getClients = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const {
      status,
      segment,
      tags,
      search,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    let query = { vendor: vendor._id };

    if (status) query.status = status;
    if (segment) query.segment = segment;
    if (tags) query.tags = { $in: Array.isArray(tags) ? tags : [tags] };

    // Search
    if (search) {
      const searchResults = await Client.searchClients(vendor._id, search);
      const clientIds = searchResults.map((c) => c._id);
      query._id = { $in: clientIds };
    }

    const skip = (page - 1) * limit;
    const clients = await Client.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Client.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: clients.length,
      data: {
        clients,
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
 * Get single client
 * GET /api/v1/vendors/clients/:id
 */
export const getClient = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const client = await Client.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    }).populate("notes.createdBy", "name email");

    if (!client) return next(new AppError("Client not found", 404));

    // Get client's booking history
    const bookings = await Booking.find({
      vendor: vendor._id,
      "customer.email": client.email,
    })
      .sort({ eventDate: -1 })
      .limit(10);

    res.status(200).json({
      status: "success",
      data: {
        client,
        bookings,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create client
 * POST /api/v1/vendors/clients
 */
export const createClient = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const clientData = {
      ...req.body,
      vendor: vendor._id,
    };

    const client = await Client.create(clientData);

    res.status(201).json({
      status: "success",
      message: "Client created successfully",
      data: { client },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update client
 * PUT /api/v1/vendors/clients/:id
 */
export const updateClient = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, vendor: vendor._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!client) return next(new AppError("Client not found", 404));

    res.status(200).json({
      status: "success",
      message: "Client updated successfully",
      data: { client },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add note to client
 * POST /api/v1/vendors/clients/:id/notes
 */
export const addNote = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { text } = req.body;
    if (!text) return next(new AppError("Note text is required", 400));

    const client = await Client.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!client) return next(new AppError("Client not found", 404));

    await client.addNote(text, req.user._id);
    await client.populate("notes.createdBy", "name email");

    res.status(200).json({
      status: "success",
      message: "Note added successfully",
      data: { notes: client.notes },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update client tags
 * PUT /api/v1/vendors/clients/:id/tags
 */
export const updateTags = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { tags } = req.body;
    if (!tags || !Array.isArray(tags)) {
      return next(new AppError("Tags array is required", 400));
    }

    const client = await Client.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!client) return next(new AppError("Client not found", 404));

    client.tags = tags;
    await client.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      message: "Tags updated successfully",
      data: { client },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get client history
 * GET /api/v1/vendors/clients/:id/history
 */
export const getClientHistory = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const client = await Client.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!client) return next(new AppError("Client not found", 404));

    // Get all bookings
    const bookings = await Booking.find({
      vendor: vendor._id,
      "customer.email": client.email,
    }).sort({ eventDate: -1 });

    // Get all leads
    const Lead = (await import("../models/lead.model.js")).default;
    const leads = await Lead.find({
      vendor: vendor._id,
      "customer.email": client.email,
    }).sort({ createdAt: -1 });

    // Get all quotes
    const Quote = (await import("../models/quote.model.js")).default;
    const quotes = await Quote.find({
      vendor: vendor._id,
      "customer.email": client.email,
    }).sort({ createdAt: -1 });

    // Get all invoices
    const Invoice = (await import("../models/invoice.model.js")).default;
    const invoices = await Invoice.find({
      vendor: vendor._id,
      "customer.email": client.email,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      data: {
        client,
        history: {
          bookings,
          leads,
          quotes,
          invoices,
        },
        summary: {
          totalBookings: bookings.length,
          totalLeads: leads.length,
          totalQuotes: quotes.length,
          totalInvoices: invoices.length,
          totalSpent: client.totalSpent,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete client
 * DELETE /api/v1/vendors/clients/:id
 */
export const deleteClient = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const client = await Client.findOneAndDelete({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!client) return next(new AppError("Client not found", 404));

    res.status(200).json({
      status: "success",
      message: "Client deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
