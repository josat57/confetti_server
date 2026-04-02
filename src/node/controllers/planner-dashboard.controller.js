import Event from "../models/event.model.js";
import Client from "../models/client.model.js";
import Task from "../models/task.model.js";
import Booking from "../models/booking.model.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
// Temporarily using native Date functions instead of date-fns
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);
const subMonths = (date, months) =>
  new Date(date.getFullYear(), date.getMonth() - months, date.getDate());
const format = (date, formatStr) => date.toISOString().split("T")[0];

/**
 * Get dashboard overview metrics
 * GET /api/v1/planner/dashboard/metrics
 */
export const getDashboardMetrics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentMonth = new Date();
    const lastMonth = subMonths(currentMonth, 1);

    // Get current month metrics
    const [
      totalEvents,
      activeEvents,
      completedEvents,
      totalClients,
      activeTasks,
      overdueTasks,
      totalRevenue,
      pendingBookings,
    ] = await Promise.all([
      Event.countDocuments({
        owner: userId,
        ownerType: "event-planner",
        createdAt: {
          $gte: startOfMonth(currentMonth),
          $lte: endOfMonth(currentMonth),
        },
      }),
      Event.countDocuments({
        owner: userId,
        ownerType: "event-planner",
        status: { $in: ["planning", "confirmed", "in-progress"] },
      }),
      Event.countDocuments({
        owner: userId,
        ownerType: "event-planner",
        status: "completed",
        createdAt: {
          $gte: startOfMonth(currentMonth),
          $lte: endOfMonth(currentMonth),
        },
      }),
      Client.countDocuments({ plannerId: userId }),
      Task.countDocuments({
        assignedTo: userId,
        status: { $ne: "completed" },
      }),
      Task.countDocuments({
        assignedTo: userId,
        status: { $ne: "completed" },
        dueDate: { $lt: new Date() },
      }),
      Event.aggregate([
        { $match: { owner: userId, ownerType: "event-planner" } },
        { $group: { _id: null, total: { $sum: "$budget.amount" } } },
      ]),
      Booking.countDocuments({
        plannerId: userId,
        status: "pending",
      }),
    ]);

    // Get last month metrics for comparison
    const [lastMonthEvents, lastMonthRevenue] = await Promise.all([
      Event.countDocuments({
        owner: userId,
        ownerType: "event-planner",
        createdAt: {
          $gte: startOfMonth(lastMonth),
          $lte: endOfMonth(lastMonth),
        },
      }),
      Event.aggregate([
        {
          $match: {
            owner: userId,
            ownerType: "event-planner",
            createdAt: {
              $gte: startOfMonth(lastMonth),
              $lte: endOfMonth(lastMonth),
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$budget.amount" } } },
      ]),
    ]);

    // Calculate growth percentages
    const eventsGrowth =
      lastMonthEvents > 0
        ? (((totalEvents - lastMonthEvents) / lastMonthEvents) * 100).toFixed(1)
        : totalEvents > 0
        ? 100
        : 0;

    const revenueGrowth =
      lastMonthRevenue[0]?.total > 0
        ? (
            ((totalRevenue[0]?.total || 0 - lastMonthRevenue[0].total) /
              lastMonthRevenue[0].total) *
            100
          ).toFixed(1)
        : totalRevenue[0]?.total > 0
        ? 100
        : 0;

    res.status(200).json({
      status: "success",
      data: {
        overview: {
          totalEvents,
          activeEvents,
          completedEvents,
          totalClients,
          activeTasks,
          overdueTasks,
          totalRevenue: totalRevenue[0]?.total || 0,
          pendingBookings,
        },
        growth: {
          events: `${eventsGrowth}%`,
          revenue: `${revenueGrowth}%`,
        },
        period: {
          current: format(currentMonth, "MMMM yyyy"),
          previous: format(lastMonth, "MMMM yyyy"),
        },
      },
    });
  } catch (error) {
    logger.error("Dashboard metrics error:", error);
    next(new AppError("Failed to fetch dashboard metrics", 500));
  }
};

/**
 * Get dashboard activity feed
 * GET /api/v1/planner/dashboard/activity
 */
export const getDashboardActivity = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    // Get recent activities from various sources
    const [recentEvents, recentTasks, recentBookings] = await Promise.all([
      Event.find({
        owner: userId,
        ownerType: "event-planner",
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("title status updatedAt eventDate")
        .lean(),

      Task.find({ assignedTo: userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("title status updatedAt dueDate")
        .populate("event", "title")
        .lean(),

      Booking.find({ plannerId: userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("status updatedAt")
        .populate("vendor", "businessName")
        .populate("event", "title")
        .lean(),
    ]);

    // Combine and format activities
    const activities = [];

    recentEvents.forEach((event) => {
      activities.push({
        type: "event",
        title: `Event "${event.title}" ${event.status}`,
        timestamp: event.updatedAt,
        metadata: {
          eventId: event._id,
          status: event.status,
          eventDate: event.eventDate,
        },
      });
    });

    recentTasks.forEach((task) => {
      activities.push({
        type: "task",
        title: `Task "${task.title}" ${task.status}`,
        timestamp: task.updatedAt,
        metadata: {
          taskId: task._id,
          status: task.status,
          dueDate: task.dueDate,
          event: task.event?.title,
        },
      });
    });

    recentBookings.forEach((booking) => {
      activities.push({
        type: "booking",
        title: `Booking with ${booking.vendor?.businessName} ${booking.status}`,
        timestamp: booking.updatedAt,
        metadata: {
          bookingId: booking._id,
          status: booking.status,
          vendor: booking.vendor?.businessName,
          event: booking.event?.title,
        },
      });
    });

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, limit);

    res.status(200).json({
      status: "success",
      data: {
        activities: limitedActivities,
        total: activities.length,
      },
    });
  } catch (error) {
    logger.error("Dashboard activity error:", error);
    next(new AppError("Failed to fetch dashboard activity", 500));
  }
};

/**
 * Get quick stats for dashboard
 * GET /api/v1/planner/dashboard/quick-stats
 */
export const getQuickStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [upcomingEvents, tasksThisWeek, overdueItems, recentClients] =
      await Promise.all([
        Event.find({
          owner: userId,
          ownerType: "event-planner",
          eventDate: { $gte: today, $lte: nextWeek },
          status: { $in: ["confirmed", "planning"] },
        })
          .sort({ eventDate: 1 })
          .limit(5)
          .select("title eventDate status location")
          .lean(),

        Task.find({
          assignedTo: userId,
          dueDate: { $gte: today, $lte: nextWeek },
          status: { $ne: "completed" },
        })
          .sort({ dueDate: 1 })
          .limit(5)
          .select("title dueDate priority status")
          .populate("event", "title")
          .lean(),

        Task.countDocuments({
          assignedTo: userId,
          dueDate: { $lt: today },
          status: { $ne: "completed" },
        }),

        Client.find({ plannerId: userId })
          .sort({ createdAt: -1 })
          .limit(3)
          .select("name email phone createdAt")
          .lean(),
      ]);

    res.status(200).json({
      status: "success",
      data: {
        upcomingEvents,
        tasksThisWeek,
        overdueItems,
        recentClients,
        summary: {
          eventsThisWeek: upcomingEvents.length,
          tasksThisWeek: tasksThisWeek.length,
          overdueItems,
          totalClients: recentClients.length,
        },
      },
    });
  } catch (error) {
    logger.error("Quick stats error:", error);
    next(new AppError("Failed to fetch quick stats", 500));
  }
};

export default {
  getDashboardMetrics,
  getDashboardActivity,
  getQuickStats,
};
