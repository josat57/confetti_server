import Client from "../models/client.model.js";
import Event from "../models/event.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * List all clients for planner
 * GET /api/v1/planner/clients
 */
export const listClients = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const plannerId = req.user._id;

    const query = { planner: plannerId };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }

    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Client.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        clients,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new client
 * POST /api/v1/planner/clients
 */
export const createClient = async (req, res, next) => {
  try {
    const plannerId = req.user._id;

    const client = await Client.create({
      ...req.body,
      planner: plannerId,
    });

    res.status(201).json({
      status: "success",
      data: { client },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get client details
 * GET /api/v1/planner/clients/:id
 */
export const getClient = async (req, res, next) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { client },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update client
 * PATCH /api/v1/planner/clients/:id
 */
export const updateClient = async (req, res, next) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, planner: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { client },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete client
 * DELETE /api/v1/planner/clients/:id
 */
export const deleteClient = async (req, res, next) => {
  try {
    // Check if client has events
    const eventsCount = await Event.countDocuments({ client: req.params.id });

    if (eventsCount > 0) {
      return next(
        new AppError(
          "Cannot delete client with existing events. Archive instead.",
          400
        )
      );
    }

    const client = await Client.findOneAndDelete({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Client deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get client events
 * GET /api/v1/planner/clients/:id/events
 */
export const getClientEvents = async (req, res, next) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    const events = await Event.find({ client: req.params.id })
      .sort({ startDate: -1 })
      .select("name type status startDate endDate budget")
      .lean();

    res.status(200).json({
      status: "success",
      data: { events },
    });
  } catch (error) {
    next(error);
  }
};
