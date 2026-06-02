import Client from "../models/client.model.js";
import Vendor from "../models/vendor.model.js";
import Booking from "../models/booking.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * Get new client form metadata
 * GET /api/v1/vendors/clients/new
 */
export const getNewClientForm = async (req, res, next) => {
  try {
    // Return metadata for creating a new client
    res.status(200).json({
      status: "success",
      message: "Use POST /api/v1/vendors/clients to create a new client",
      data: {
        endpoint: "/api/v1/vendors/clients",
        method: "POST",
        requiredFields: ["name", "email"],
        optionalFields: [
          "phone",
          "company",
          "address",
          "notes",
          "tags",
          "segment",
          "source",
        ],
        availableSegments: ["vip", "regular", "potential"],
        availableSources: [
          "website",
          "referral",
          "social_media",
          "event",
          "other",
        ],
        examplePayload: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+1234567890",
          company: "Acme Corp",
          segment: "regular",
          source: "website",
          tags: ["wedding", "corporate"],
          notes: "Interested in catering services", // Can be a string, will be converted to array
        },
        note: "The 'notes' field can be sent as a string and will be automatically converted to the proper format",
      },
    });
  } catch (error) {
    next(error);
  }
};

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

    // Query by planner (which is set to vendor owner's user ID)
    let query = { planner: req.user._id };

    if (status) query.status = status;
    if (segment) query.segment = segment;
    if (tags) query.tags = { $in: Array.isArray(tags) ? tags : [tags] };

    // Search by name, email, company, or phone
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
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

    // Query by planner (which is set to vendor owner's user ID)
    const client = await Client.findOne({
      _id: req.params.id,
      planner: req.user._id,
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

    // Prepare client data
    const clientData = {
      ...req.body,
      vendor: vendor._id,
      // Set planner to the vendor owner (required by model)
      planner: req.user._id,
    };

    // Handle notes field - convert string to array format if needed
    if (clientData.notes && typeof clientData.notes === "string") {
      clientData.notes = [
        {
          content: clientData.notes,
          createdBy: req.user._id,
          createdAt: new Date(),
        },
      ];
    }

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
      { _id: req.params.id, planner: req.user._id },
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
      planner: req.user._id,
    });

    if (!client) return next(new AppError("Client not found", 404));

    // Add note to the notes array
    client.notes.push({
      content: text,
      createdBy: req.user._id,
      createdAt: new Date(),
    });

    await client.save();
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
      planner: req.user._id,
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
      planner: req.user._id,
    });

    if (!client) return next(new AppError("Client not found", 404));

    // Get client history (capped per type to avoid large payloads)
    const bookings = await Booking.find({
      vendor: vendor._id,
      "customer.email": client.email,
    }).sort({ eventDate: -1 }).limit(100).lean();

    const Lead = (await import("../models/lead.model.js")).default;
    const leads = await Lead.find({
      vendor: vendor._id,
      "customer.email": client.email,
    }).sort({ createdAt: -1 }).limit(100).lean();

    const Quote = (await import("../models/quote.model.js")).default;
    const quotes = await Quote.find({
      vendor: vendor._id,
      "customer.email": client.email,
    }).sort({ createdAt: -1 }).limit(100).lean();

    const Invoice = (await import("../models/invoice.model.js")).default;
    const invoices = await Invoice.find({
      vendor: vendor._id,
      "customer.email": client.email,
    }).sort({ createdAt: -1 }).limit(100).lean();

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
 * Update client follow-up date
 * PATCH /api/v1/vendors/clients/:id/follow-up
 */
export const updateFollowUp = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { nextFollowUp } = req.body;
    if (!nextFollowUp) {
      return next(new AppError("Next follow-up date is required", 400));
    }

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, planner: req.user._id },
      { nextFollowUp: new Date(nextFollowUp) },
      { new: true, runValidators: true }
    );

    if (!client) return next(new AppError("Client not found", 404));

    res.status(200).json({
      status: "success",
      message: "Follow-up date updated successfully",
      data: { client },
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
      planner: req.user._id,
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
