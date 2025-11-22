import Task from "../models/task.model.js";
import Event from "../models/event.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * List tasks for an event
 * GET /api/v1/events/:eventId/tasks
 */
export const listEventTasks = async (req, res, next) => {
  try {
    const { status, priority, assignee } = req.query;
    const query = { event: req.params.eventId };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignee) query.assignee = assignee;

    const tasks = await Task.find(query)
      .populate("assignee", "firstName lastName email")
      .sort({ dueDate: 1, priority: -1 })
      .lean();

    res.status(200).json({
      status: "success",
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create task for an event
 * POST /api/v1/events/:eventId/tasks
 */
export const createTask = async (req, res, next) => {
  try {
    // Verify event exists and user has access
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    if (event.planner.toString() !== req.user._id.toString()) {
      return next(new AppError("Access denied", 403));
    }

    const task = await Task.create({
      ...req.body,
      event: req.params.eventId,
    });

    await task.populate("assignee", "firstName lastName email");

    res.status(201).json({
      status: "success",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get task details
 * GET /api/v1/tasks/:id
 */
export const getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignee", "firstName lastName email")
      .populate("event", "name type")
      .populate("dependencies");

    if (!task) {
      return next(new AppError("Task not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update task
 * PATCH /api/v1/tasks/:id
 */
export const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("assignee", "firstName lastName email");

    if (!task) {
      return next(new AppError("Task not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete task
 * DELETE /api/v1/tasks/:id
 */
export const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return next(new AppError("Task not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Task deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark task as complete
 * POST /api/v1/tasks/:id/complete
 */
export const completeTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return next(new AppError("Task not found", 404));
    }

    await task.markComplete(req.user._id);

    res.status(200).json({
      status: "success",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all tasks for planner
 * GET /api/v1/planner/tasks
 */
export const listAllTasks = async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 50 } = req.query;

    // Get all events for this planner
    const events = await Event.find({ planner: req.user._id }).select("_id");
    const eventIds = events.map((e) => e._id);

    const query = { event: { $in: eventIds } };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tasks = await Task.find(query)
      .populate("assignee", "firstName lastName email")
      .populate("event", "name type")
      .sort({ dueDate: 1, priority: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Task.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        tasks,
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
