import Event from "../models/event.model.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Get planner dashboard metrics
 * GET /api/v1/planner/dashboard/metrics
 */
export const getDashboardMetrics = async (req, res, next) => {
  try {
    const plannerId = req.user._id;

    // Get events count by status
    const [
      activeEvents,
      planningEvents,
      completedEvents,
      totalEvents,
      upcomingEvents,
    ] = await Promise.all([
      Event.countDocuments({ planner: plannerId, status: "active" }),
      Event.countDocuments({ planner: plannerId, status: "planning" }),
      Event.countDocuments({ planner: plannerId, status: "completed" }),
      Event.countDocuments({ planner: plannerId }),
      Event.countDocuments({
        planner: plannerId,
        startDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    // Get total budget across all active events
    const budgetAggregation = await Event.aggregate([
      {
        $match: { planner: plannerId, status: { $in: ["active", "planning"] } },
      },
      {
        $group: {
          _id: null,
          totalBudget: { $sum: "$budget.amount" },
          totalSpent: { $sum: { $sum: "$budget.categories.spent" } },
        },
      },
    ]);

    const budgetData = budgetAggregation[0] || {
      totalBudget: 0,
      totalSpent: 0,
    };

    // Get pending tasks count
    const pendingTasks = await Event.aggregate([
      { $match: { planner: plannerId } },
      { $unwind: "$tasks" },
      { $match: { "tasks.status": { $ne: "completed" } } },
      { $count: "total" },
    ]);

    const metrics = {
      events: {
        total: totalEvents,
        active: activeEvents,
        planning: planningEvents,
        completed: completedEvents,
        upcoming: upcomingEvents,
      },
      budget: {
        total: budgetData.totalBudget,
        spent: budgetData.totalSpent,
        remaining: budgetData.totalBudget - budgetData.totalSpent,
        utilizationPercentage:
          budgetData.totalBudget > 0
            ? ((budgetData.totalSpent / budgetData.totalBudget) * 100).toFixed(
                2
              )
            : 0,
      },
      tasks: {
        pending: pendingTasks[0]?.total || 0,
      },
    };

    res.status(200).json({
      status: "success",
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get planner dashboard activity feed
 * GET /api/v1/planner/dashboard/activity
 */
export const getDashboardActivity = async (req, res, next) => {
  try {
    const plannerId = req.user._id;
    const { limit = 20 } = req.query;

    // Get recent events
    const recentEvents = await Event.find({ planner: plannerId })
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .select("name type status updatedAt")
      .lean();

    // Format activity feed
    const activities = recentEvents.map((event) => ({
      type: "event_update",
      event: event.name,
      eventId: event._id,
      status: event.status,
      timestamp: event.updatedAt,
    }));

    res.status(200).json({
      status: "success",
      data: {
        activities,
        total: activities.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get quick stats for dashboard
 * GET /api/v1/planner/dashboard/quick-stats
 */
export const getQuickStats = async (req, res, next) => {
  try {
    const plannerId = req.user._id;
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [eventsNext7Days, overdueTasksCount] = await Promise.all([
      Event.countDocuments({
        planner: plannerId,
        startDate: { $gte: now, $lte: next7Days },
      }),
      Event.aggregate([
        { $match: { planner: plannerId } },
        { $unwind: "$tasks" },
        {
          $match: {
            "tasks.status": { $ne: "completed" },
            "tasks.dueDate": { $lt: now },
          },
        },
        { $count: "total" },
      ]),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        eventsNext7Days,
        overdueTasks: overdueTasksCount[0]?.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
