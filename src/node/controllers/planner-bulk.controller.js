import Event from "../models/event.model.js";
import Task from "../models/task.model.js";
import Client from "../models/client.model.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";

/**
 * Bulk operations for events
 * POST /api/v1/planner/events/bulk-action
 */
export const bulkEventAction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { action, eventIds, data } = req.body;

    if (!action || !eventIds || !Array.isArray(eventIds)) {
      return next(new AppError("Action and eventIds array are required", 400));
    }

    if (eventIds.length === 0) {
      return next(new AppError("At least one event ID is required", 400));
    }

    if (eventIds.length > 50) {
      return next(
        new AppError("Maximum 50 events can be processed at once", 400)
      );
    }

    // Verify all events belong to the planner
    const events = await Event.find({
      _id: { $in: eventIds },
      owner: userId,
      ownerType: "event-planner",
    });

    if (events.length !== eventIds.length) {
      return next(new AppError("Some events not found or access denied", 404));
    }

    let result = {};

    switch (action) {
      case "delete":
        result = await bulkDeleteEvents(eventIds, userId);
        break;

      case "updateStatus":
        if (!data?.status) {
          return next(
            new AppError("Status is required for status update", 400)
          );
        }
        result = await bulkUpdateEventStatus(eventIds, data.status, userId);
        break;

      case "assignClient":
        if (!data?.clientId) {
          return next(
            new AppError("Client ID is required for client assignment", 400)
          );
        }
        result = await bulkAssignClient(eventIds, data.clientId, userId);
        break;

      case "updateCategory":
        if (!data?.category) {
          return next(
            new AppError("Category is required for category update", 400)
          );
        }
        result = await bulkUpdateCategory(eventIds, data.category, userId);
        break;

      case "archive":
        result = await bulkArchiveEvents(eventIds, userId);
        break;

      case "unarchive":
        result = await bulkUnarchiveEvents(eventIds, userId);
        break;

      default:
        return next(new AppError("Invalid bulk action", 400));
    }

    res.status(200).json({
      status: "success",
      message: `Bulk ${action} completed successfully`,
      data: {
        action,
        processedCount: result.processedCount,
        successCount: result.successCount,
        failedCount: result.failedCount,
        details: result.details,
      },
    });
  } catch (error) {
    logger.error("Bulk event action error:", error);
    next(new AppError("Bulk operation failed", 500));
  }
};

/**
 * Bulk delete events
 */
const bulkDeleteEvents = async (eventIds, userId) => {
  try {
    // Also delete related tasks
    await Task.deleteMany({
      event: { $in: eventIds },
      assignedTo: userId,
    });

    const deleteResult = await Event.deleteMany({
      _id: { $in: eventIds },
      owner: userId,
      ownerType: "event-planner",
    });

    return {
      processedCount: eventIds.length,
      successCount: deleteResult.deletedCount,
      failedCount: eventIds.length - deleteResult.deletedCount,
      details: {
        deletedEvents: deleteResult.deletedCount,
        message: `${deleteResult.deletedCount} events and related tasks deleted`,
      },
    };
  } catch (error) {
    logger.error("Bulk delete events error:", error);
    throw error;
  }
};

/**
 * Bulk update event status
 */
const bulkUpdateEventStatus = async (eventIds, status, userId) => {
  try {
    const validStatuses = [
      "planning",
      "confirmed",
      "in-progress",
      "completed",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      throw new AppError("Invalid status value", 400);
    }

    const updateResult = await Event.updateMany(
      {
        _id: { $in: eventIds },
        owner: userId,
        ownerType: "event-planner",
      },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    return {
      processedCount: eventIds.length,
      successCount: updateResult.modifiedCount,
      failedCount: eventIds.length - updateResult.modifiedCount,
      details: {
        newStatus: status,
        message: `${updateResult.modifiedCount} events updated to ${status}`,
      },
    };
  } catch (error) {
    logger.error("Bulk update status error:", error);
    throw error;
  }
};

/**
 * Bulk assign client to events
 */
const bulkAssignClient = async (eventIds, clientId, userId) => {
  try {
    // Verify client exists and belongs to planner
    const client = await Client.findOne({
      _id: clientId,
      plannerId: userId,
    });

    if (!client) {
      throw new AppError("Client not found or access denied", 404);
    }

    const updateResult = await Event.updateMany(
      {
        _id: { $in: eventIds },
        owner: userId,
        ownerType: "event-planner",
      },
      {
        $set: {
          client: clientId,
          updatedAt: new Date(),
        },
      }
    );

    return {
      processedCount: eventIds.length,
      successCount: updateResult.modifiedCount,
      failedCount: eventIds.length - updateResult.modifiedCount,
      details: {
        clientId,
        clientName: client.name,
        message: `${updateResult.modifiedCount} events assigned to ${client.name}`,
      },
    };
  } catch (error) {
    logger.error("Bulk assign client error:", error);
    throw error;
  }
};

/**
 * Bulk update event category
 */
const bulkUpdateCategory = async (eventIds, category, userId) => {
  try {
    const validCategories = [
      "wedding",
      "birthday",
      "corporate",
      "social",
      "conference",
      "exhibition",
      "other",
    ];

    if (!validCategories.includes(category)) {
      throw new AppError("Invalid category value", 400);
    }

    const updateResult = await Event.updateMany(
      {
        _id: { $in: eventIds },
        owner: userId,
        ownerType: "event-planner",
      },
      {
        $set: {
          eventType: category,
          updatedAt: new Date(),
        },
      }
    );

    return {
      processedCount: eventIds.length,
      successCount: updateResult.modifiedCount,
      failedCount: eventIds.length - updateResult.modifiedCount,
      details: {
        newCategory: category,
        message: `${updateResult.modifiedCount} events updated to ${category} category`,
      },
    };
  } catch (error) {
    logger.error("Bulk update category error:", error);
    throw error;
  }
};

/**
 * Bulk archive events
 */
const bulkArchiveEvents = async (eventIds, userId) => {
  try {
    const updateResult = await Event.updateMany(
      {
        _id: { $in: eventIds },
        owner: userId,
        ownerType: "event-planner",
      },
      {
        $set: {
          archived: true,
          archivedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return {
      processedCount: eventIds.length,
      successCount: updateResult.modifiedCount,
      failedCount: eventIds.length - updateResult.modifiedCount,
      details: {
        message: `${updateResult.modifiedCount} events archived`,
      },
    };
  } catch (error) {
    logger.error("Bulk archive events error:", error);
    throw error;
  }
};

/**
 * Bulk unarchive events
 */
const bulkUnarchiveEvents = async (eventIds, userId) => {
  try {
    const updateResult = await Event.updateMany(
      {
        _id: { $in: eventIds },
        owner: userId,
        ownerType: "event-planner",
      },
      {
        $unset: {
          archived: 1,
          archivedAt: 1,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    return {
      processedCount: eventIds.length,
      successCount: updateResult.modifiedCount,
      failedCount: eventIds.length - updateResult.modifiedCount,
      details: {
        message: `${updateResult.modifiedCount} events unarchived`,
      },
    };
  } catch (error) {
    logger.error("Bulk unarchive events error:", error);
    throw error;
  }
};

/**
 * Bulk operations for tasks
 * POST /api/v1/planner/tasks/bulk-action
 */
export const bulkTaskAction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { action, taskIds, data } = req.body;

    if (!action || !taskIds || !Array.isArray(taskIds)) {
      return next(new AppError("Action and taskIds array are required", 400));
    }

    if (taskIds.length === 0) {
      return next(new AppError("At least one task ID is required", 400));
    }

    if (taskIds.length > 100) {
      return next(
        new AppError("Maximum 100 tasks can be processed at once", 400)
      );
    }

    // Verify all tasks belong to the planner
    const tasks = await Task.find({
      _id: { $in: taskIds },
      assignedTo: userId,
    });

    if (tasks.length !== taskIds.length) {
      return next(new AppError("Some tasks not found or access denied", 404));
    }

    let result = {};

    switch (action) {
      case "complete":
        result = await bulkCompleteTasks(taskIds, userId);
        break;

      case "delete":
        result = await bulkDeleteTasks(taskIds, userId);
        break;

      case "updatePriority":
        if (!data?.priority) {
          return next(
            new AppError("Priority is required for priority update", 400)
          );
        }
        result = await bulkUpdateTaskPriority(taskIds, data.priority, userId);
        break;

      case "updateDueDate":
        if (!data?.dueDate) {
          return next(
            new AppError("Due date is required for due date update", 400)
          );
        }
        result = await bulkUpdateTaskDueDate(taskIds, data.dueDate, userId);
        break;

      default:
        return next(new AppError("Invalid bulk action", 400));
    }

    res.status(200).json({
      status: "success",
      message: `Bulk ${action} completed successfully`,
      data: {
        action,
        processedCount: result.processedCount,
        successCount: result.successCount,
        failedCount: result.failedCount,
        details: result.details,
      },
    });
  } catch (error) {
    logger.error("Bulk task action error:", error);
    next(new AppError("Bulk task operation failed", 500));
  }
};

/**
 * Bulk complete tasks
 */
const bulkCompleteTasks = async (taskIds, userId) => {
  try {
    const updateResult = await Task.updateMany(
      {
        _id: { $in: taskIds },
        assignedTo: userId,
      },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return {
      processedCount: taskIds.length,
      successCount: updateResult.modifiedCount,
      failedCount: taskIds.length - updateResult.modifiedCount,
      details: {
        message: `${updateResult.modifiedCount} tasks marked as completed`,
      },
    };
  } catch (error) {
    logger.error("Bulk complete tasks error:", error);
    throw error;
  }
};

/**
 * Bulk delete tasks
 */
const bulkDeleteTasks = async (taskIds, userId) => {
  try {
    const deleteResult = await Task.deleteMany({
      _id: { $in: taskIds },
      assignedTo: userId,
    });

    return {
      processedCount: taskIds.length,
      successCount: deleteResult.deletedCount,
      failedCount: taskIds.length - deleteResult.deletedCount,
      details: {
        message: `${deleteResult.deletedCount} tasks deleted`,
      },
    };
  } catch (error) {
    logger.error("Bulk delete tasks error:", error);
    throw error;
  }
};

/**
 * Bulk update task priority
 */
const bulkUpdateTaskPriority = async (taskIds, priority, userId) => {
  try {
    const validPriorities = ["low", "medium", "high", "urgent"];

    if (!validPriorities.includes(priority)) {
      throw new AppError("Invalid priority value", 400);
    }

    const updateResult = await Task.updateMany(
      {
        _id: { $in: taskIds },
        assignedTo: userId,
      },
      {
        $set: {
          priority,
          updatedAt: new Date(),
        },
      }
    );

    return {
      processedCount: taskIds.length,
      successCount: updateResult.modifiedCount,
      failedCount: taskIds.length - updateResult.modifiedCount,
      details: {
        newPriority: priority,
        message: `${updateResult.modifiedCount} tasks updated to ${priority} priority`,
      },
    };
  } catch (error) {
    logger.error("Bulk update task priority error:", error);
    throw error;
  }
};

/**
 * Bulk update task due date
 */
const bulkUpdateTaskDueDate = async (taskIds, dueDate, userId) => {
  try {
    const updateResult = await Task.updateMany(
      {
        _id: { $in: taskIds },
        assignedTo: userId,
      },
      {
        $set: {
          dueDate: new Date(dueDate),
          updatedAt: new Date(),
        },
      }
    );

    return {
      processedCount: taskIds.length,
      successCount: updateResult.modifiedCount,
      failedCount: taskIds.length - updateResult.modifiedCount,
      details: {
        newDueDate: dueDate,
        message: `${updateResult.modifiedCount} tasks due date updated`,
      },
    };
  } catch (error) {
    logger.error("Bulk update task due date error:", error);
    throw error;
  }
};

export default {
  bulkEventAction,
  bulkTaskAction,
};
