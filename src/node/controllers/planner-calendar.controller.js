import Event from "../models/event.model.js";
import Task from "../models/task.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Controller for Planner Calendar endpoints
 */
class PlannerCalendarController {
  /**
   * Get calendar data for date range
   * GET /api/v1/planner/calendar
   */
  async getCalendar(req, res, next) {
    try {
      const plannerId = req.user.id;
      const {
        startDate,
        endDate,
        view = "month",
        includeEvents = true,
        includeTasks = true,
      } = req.query;

      if (!startDate || !endDate) {
        throw new AppError("Start date and end date are required", 400);
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError("Invalid date format", 400);
      }

      logger.info("Fetching calendar data", {
        plannerId,
        startDate,
        endDate,
        view,
      });

      const calendarData = {
        events: [],
        tasks: [],
        view,
        dateRange: {
          start: start,
          end: end,
        },
      };

      // Fetch events if requested
      if (includeEvents === "true" || includeEvents === true) {
        const events = await Event.find({
          planner: plannerId,
          $or: [
            {
              startDate: { $gte: start, $lte: end },
            },
            {
              endDate: { $gte: start, $lte: end },
            },
            {
              startDate: { $lte: start },
              endDate: { $gte: end },
            },
          ],
        })
          .select(
            "title description eventType startDate endDate location status budget guestCount client"
          )
          .populate("client", "name email")
          .sort({ startDate: 1 })
          .lean();

        calendarData.events = events.map((event) => ({
          id: event._id,
          title: event.title,
          description: event.description,
          type: "event",
          eventType: event.eventType,
          start: event.startDate,
          end: event.endDate,
          location: event.location?.address,
          status: event.status,
          budget: event.budget,
          guestCount: event.guestCount,
          client: event.client,
          color: this._getEventColor(event.eventType),
        }));
      }

      // Fetch tasks if requested
      if (includeTasks === "true" || includeTasks === true) {
        const tasks = await Task.find({
          planner: plannerId,
          dueDate: { $gte: start, $lte: end },
        })
          .select(
            "title description dueDate priority status category event assignee"
          )
          .populate("event", "title eventType")
          .populate("assignee", "firstName lastName email")
          .sort({ dueDate: 1 })
          .lean();

        calendarData.tasks = tasks.map((task) => ({
          id: task._id,
          title: task.title,
          description: task.description,
          type: "task",
          start: task.dueDate,
          end: task.dueDate,
          priority: task.priority,
          status: task.status,
          category: task.category,
          event: task.event,
          assignee: task.assignee,
          color: this._getTaskColor(task.priority),
        }));
      }

      // Combine and sort all items
      const allItems = [...calendarData.events, ...calendarData.tasks].sort(
        (a, b) => new Date(a.start) - new Date(b.start)
      );

      res.status(200).json({
        success: true,
        data: {
          ...calendarData,
          allItems,
          summary: {
            totalEvents: calendarData.events.length,
            totalTasks: calendarData.tasks.length,
            totalItems: allItems.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check availability for scheduling
   * GET /api/v1/planner/calendar/availability
   */
  async checkAvailability(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { date, duration = 60 } = req.query; // duration in minutes

      if (!date) {
        throw new AppError("Date is required", 400);
      }

      const checkDate = new Date(date);
      if (isNaN(checkDate.getTime())) {
        throw new AppError("Invalid date format", 400);
      }

      const endDate = new Date(checkDate.getTime() + duration * 60 * 1000);

      logger.info("Checking availability", {
        plannerId,
        date,
        duration,
      });

      // Check for conflicting events
      const conflictingEvents = await Event.find({
        planner: plannerId,
        $or: [
          {
            startDate: { $lte: checkDate },
            endDate: { $gte: checkDate },
          },
          {
            startDate: { $lte: endDate },
            endDate: { $gte: endDate },
          },
          {
            startDate: { $gte: checkDate },
            endDate: { $lte: endDate },
          },
        ],
      })
        .select("title startDate endDate eventType location")
        .lean();

      // Check for conflicting tasks
      const conflictingTasks = await Task.find({
        planner: plannerId,
        dueDate: { $gte: checkDate, $lte: endDate },
        status: { $ne: "completed" },
      })
        .select("title dueDate priority event")
        .populate("event", "title")
        .lean();

      const hasConflicts =
        conflictingEvents.length > 0 || conflictingTasks.length > 0;

      res.status(200).json({
        success: true,
        data: {
          available: !hasConflicts,
          date: checkDate,
          duration,
          conflicts: {
            events: conflictingEvents,
            tasks: conflictingTasks,
            total: conflictingEvents.length + conflictingTasks.length,
          },
          suggestions: hasConflicts
            ? this._generateAlternativeTimes(checkDate, duration)
            : [],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync calendar with external providers (Professional+ tier)
   * POST /api/v1/planner/calendar/sync
   */
  async syncCalendar(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { provider, action = "sync" } = req.body; // provider: 'google' | 'outlook'

      if (!provider) {
        throw new AppError("Calendar provider is required", 400);
      }

      if (!["google", "outlook"].includes(provider)) {
        throw new AppError(
          "Invalid calendar provider. Use 'google' or 'outlook'",
          400
        );
      }

      // Check subscription tier (Professional+ required)
      const User = (await import("../models/user.model.js")).default;
      const Subscription = (await import("../models/subscription.model.js"))
        .default;

      const user = await User.findById(plannerId).populate("subscription");
      if (!user || !user.subscription) {
        throw new AppError("Active subscription required", 403);
      }

      const subscription = await Subscription.findById(user.subscription);
      const allowedTiers = ["Professional", "Business", "Enterprise"];

      if (!allowedTiers.includes(subscription.planName)) {
        throw new AppError(
          "Calendar sync is only available for Professional, Business, and Enterprise tiers",
          403
        );
      }

      logger.info("Calendar sync requested", {
        plannerId,
        provider,
        action,
      });

      // TODO: Implement actual calendar sync with Google/Outlook APIs
      // This is a placeholder for the integration

      res.status(200).json({
        success: true,
        message: `Calendar sync with ${provider} initiated`,
        data: {
          provider,
          action,
          status: "pending",
          message:
            "Calendar sync feature coming soon. Integration with Google Calendar and Outlook Calendar will be available in the next release.",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export calendar to iCal format
   * GET /api/v1/planner/calendar/export
   */
  async exportCalendar(req, res, next) {
    try {
      const plannerId = req.user.id;
      const {
        startDate,
        endDate,
        includeEvents = true,
        includeTasks = true,
      } = req.query;

      logger.info("Exporting calendar", { plannerId });

      // Build date filter
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate);
      }

      const icalData = [];
      icalData.push("BEGIN:VCALENDAR");
      icalData.push("VERSION:2.0");
      icalData.push("PRODID:-//Confetti Event Planner//EN");
      icalData.push("CALSCALE:GREGORIAN");
      icalData.push("METHOD:PUBLISH");
      icalData.push("X-WR-CALNAME:Event Planner Calendar");
      icalData.push("X-WR-TIMEZONE:UTC");

      // Export events
      if (includeEvents === "true" || includeEvents === true) {
        const query = { planner: plannerId };
        if (Object.keys(dateFilter).length > 0) {
          query.startDate = dateFilter;
        }

        const events = await Event.find(query)
          .select("title description startDate endDate location eventType")
          .lean();

        events.forEach((event) => {
          icalData.push("BEGIN:VEVENT");
          icalData.push(`UID:event-${event._id}@confetti.com`);
          icalData.push(`DTSTAMP:${this._formatICalDate(new Date())}`);
          icalData.push(`DTSTART:${this._formatICalDate(event.startDate)}`);
          icalData.push(`DTEND:${this._formatICalDate(event.endDate)}`);
          icalData.push(`SUMMARY:${this._escapeICalText(event.title)}`);
          if (event.description) {
            icalData.push(
              `DESCRIPTION:${this._escapeICalText(event.description)}`
            );
          }
          if (event.location?.address?.city) {
            icalData.push(
              `LOCATION:${this._escapeICalText(event.location.address.city)}`
            );
          }
          icalData.push(`CATEGORIES:${event.eventType}`);
          icalData.push("END:VEVENT");
        });
      }

      // Export tasks
      if (includeTasks === "true" || includeTasks === true) {
        const query = { planner: plannerId };
        if (Object.keys(dateFilter).length > 0) {
          query.dueDate = dateFilter;
        }

        const tasks = await Task.find(query)
          .select("title description dueDate priority status")
          .lean();

        tasks.forEach((task) => {
          icalData.push("BEGIN:VTODO");
          icalData.push(`UID:task-${task._id}@confetti.com`);
          icalData.push(`DTSTAMP:${this._formatICalDate(new Date())}`);
          icalData.push(`DUE:${this._formatICalDate(task.dueDate)}`);
          icalData.push(`SUMMARY:${this._escapeICalText(task.title)}`);
          if (task.description) {
            icalData.push(
              `DESCRIPTION:${this._escapeICalText(task.description)}`
            );
          }
          icalData.push(`PRIORITY:${this._mapPriorityToICal(task.priority)}`);
          icalData.push(`STATUS:${this._mapStatusToICal(task.status)}`);
          icalData.push("END:VTODO");
        });
      }

      icalData.push("END:VCALENDAR");

      const icalContent = icalData.join("\r\n");

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="calendar.ics"'
      );
      res.status(200).send(icalContent);
    } catch (error) {
      next(error);
    }
  }

  // Helper methods

  _getEventColor(eventType) {
    const colors = {
      wedding: "#E91E63",
      birthday: "#9C27B0",
      corporate: "#3F51B5",
      social: "#00BCD4",
      other: "#607D8B",
    };
    return colors[eventType] || colors.other;
  }

  _getTaskColor(priority) {
    const colors = {
      urgent: "#F44336",
      high: "#FF9800",
      medium: "#FFC107",
      low: "#4CAF50",
    };
    return colors[priority] || colors.medium;
  }

  _generateAlternativeTimes(originalDate, duration) {
    const alternatives = [];
    const baseDate = new Date(originalDate);

    // Suggest times 1 hour before and after
    for (let offset of [-60, 60, 120, -120]) {
      const altDate = new Date(baseDate.getTime() + offset * 60 * 1000);
      alternatives.push({
        date: altDate,
        duration,
      });
    }

    return alternatives;
  }

  _formatICalDate(date) {
    if (!date) return "";
    const d = new Date(date);
    return (
      d.getUTCFullYear() +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      String(d.getUTCDate()).padStart(2, "0") +
      "T" +
      String(d.getUTCHours()).padStart(2, "0") +
      String(d.getUTCMinutes()).padStart(2, "0") +
      String(d.getUTCSeconds()).padStart(2, "0") +
      "Z"
    );
  }

  _escapeICalText(text) {
    if (!text) return "";
    return text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  _mapPriorityToICal(priority) {
    const map = {
      urgent: "1",
      high: "3",
      medium: "5",
      low: "7",
    };
    return map[priority] || "5";
  }

  _mapStatusToICal(status) {
    const map = {
      todo: "NEEDS-ACTION",
      "in-progress": "IN-PROCESS",
      completed: "COMPLETED",
      cancelled: "CANCELLED",
    };
    return map[status] || "NEEDS-ACTION";
  }
}

export default new PlannerCalendarController();
