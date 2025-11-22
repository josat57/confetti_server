import Event from "../models/event.model.js";
import Task from "../models/task.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * Get calendar data for planner
 * GET /api/v1/planner/calendar
 */
export const getCalendarData = async (req, res, next) => {
  try {
    const { start, end, view = "month" } = req.query;
    const plannerId = req.user._id;

    if (!start || !end) {
      return next(new AppError("Start and end dates are required", 400));
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Get events in date range
    const events = await Event.find({
      planner: plannerId,
      $or: [
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } },
      ],
    })
      .select("name type status startDate endDate location client")
      .populate("client", "name")
      .lean();

    // Get tasks with due dates in range
    const eventIds = events.map((e) => e._id);
    const tasks = await Task.find({
      event: { $in: eventIds },
      dueDate: { $gte: startDate, $lte: endDate },
      status: { $ne: "completed" },
    })
      .select("title dueDate priority event")
      .populate("event", "name")
      .lean();

    // Format for calendar
    const calendarEvents = events.map((event) => ({
      id: event._id,
      title: event.name,
      start: event.startDate,
      end: event.endDate,
      type: "event",
      status: event.status,
      eventType: event.type,
      client: event.client?.name,
      location: event.location,
    }));

    const calendarTasks = tasks.map((task) => ({
      id: task._id,
      title: task.title,
      start: task.dueDate,
      end: task.dueDate,
      type: "task",
      priority: task.priority,
      event: task.event?.name,
    }));

    res.status(200).json({
      status: "success",
      data: {
        events: calendarEvents,
        tasks: calendarTasks,
        all: [...calendarEvents, ...calendarTasks],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get events in date range
 * GET /api/v1/planner/calendar/events
 */
export const getEventsInRange = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const plannerId = req.user._id;

    if (!start || !end) {
      return next(new AppError("Start and end dates are required", 400));
    }

    const events = await Event.find({
      planner: plannerId,
      startDate: { $gte: new Date(start), $lte: new Date(end) },
    })
      .populate("client", "name email")
      .sort({ startDate: 1 })
      .lean();

    res.status(200).json({
      status: "success",
      data: { events },
    });
  } catch (error) {
    next(error);
  }
};
