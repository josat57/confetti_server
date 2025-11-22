import Event from "../models/event.model.js";
import Client from "../models/client.model.js";
import Task from "../models/task.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * Get event analytics
 * GET /api/v1/planner/analytics/events
 */
export const getEventAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const plannerId = req.user._id;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query = { planner: plannerId };
    if (Object.keys(dateFilter).length > 0) {
      query.createdAt = dateFilter;
    }

    // Events by status
    const eventsByStatus = await Event.aggregate([
      { $match: query },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Events by type
    const eventsByType = await Event.aggregate([
      { $match: query },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    // Budget analytics
    const budgetAnalytics = await Event.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalBudget: { $sum: "$budget.amount" },
          avgBudget: { $avg: "$budget.amount" },
          minBudget: { $min: "$budget.amount" },
          maxBudget: { $max: "$budget.amount" },
        },
      },
    ]);

    // Events over time (monthly)
    const eventsOverTime = await Event.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.status(200).json({
      status: "success",
      data: {
        byStatus: eventsByStatus,
        byType: eventsByType,
        budget: budgetAnalytics[0] || {},
        overTime: eventsOverTime,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get business analytics
 * GET /api/v1/planner/analytics/business
 */
export const getBusinessAnalytics = async (req, res, next) => {
  try {
    const plannerId = req.user._id;

    const [
      totalClients,
      activeClients,
      totalEvents,
      completedEvents,
      totalRevenue,
    ] = await Promise.all([
      Client.countDocuments({ planner: plannerId }),
      Client.countDocuments({ planner: plannerId, status: "active" }),
      Event.countDocuments({ planner: plannerId }),
      Event.countDocuments({ planner: plannerId, status: "completed" }),
      Event.aggregate([
        { $match: { planner: plannerId, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$budget.amount" } } },
      ]),
    ]);

    // Client retention (clients with multiple events)
    const clientRetention = await Event.aggregate([
      { $match: { planner: plannerId } },
      { $group: { _id: "$client", eventCount: { $sum: 1 } } },
      { $match: { eventCount: { $gt: 1 } } },
      { $count: "repeatClients" },
    ]);

    // Average event value
    const avgEventValue =
      completedEvents > 0 ? (totalRevenue[0]?.total || 0) / completedEvents : 0;

    res.status(200).json({
      status: "success",
      data: {
        clients: {
          total: totalClients,
          active: activeClients,
          repeatClients: clientRetention[0]?.repeatClients || 0,
          retentionRate:
            totalClients > 0
              ? ((clientRetention[0]?.repeatClients || 0) / totalClients) * 100
              : 0,
        },
        events: {
          total: totalEvents,
          completed: completedEvents,
          completionRate:
            totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0,
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          avgEventValue: avgEventValue,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get task analytics
 * GET /api/v1/planner/analytics/tasks
 */
export const getTaskAnalytics = async (req, res, next) => {
  try {
    const plannerId = req.user._id;

    // Get all events for this planner
    const events = await Event.find({ planner: plannerId }).select("_id");
    const eventIds = events.map((e) => e._id);

    // Tasks by status
    const tasksByStatus = await Task.aggregate([
      { $match: { event: { $in: eventIds } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Tasks by priority
    const tasksByPriority = await Task.aggregate([
      { $match: { event: { $in: eventIds } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    // Overdue tasks
    const overdueTasks = await Task.countDocuments({
      event: { $in: eventIds },
      status: { $ne: "completed" },
      dueDate: { $lt: new Date() },
    });

    // Completion rate
    const totalTasks = await Task.countDocuments({ event: { $in: eventIds } });
    const completedTasks = await Task.countDocuments({
      event: { $in: eventIds },
      status: "completed",
    });

    res.status(200).json({
      status: "success",
      data: {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        completionRate:
          totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        byStatus: tasksByStatus,
        byPriority: tasksByPriority,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate custom report
 * POST /api/v1/planner/reports/custom
 */
export const generateCustomReport = async (req, res, next) => {
  try {
    const { metrics, startDate, endDate, groupBy } = req.body;
    const plannerId = req.user._id;

    // Build query based on date range
    const query = { planner: plannerId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const report = {};

    // Generate report based on requested metrics
    if (metrics.includes("events")) {
      report.events = await Event.countDocuments(query);
    }

    if (metrics.includes("clients")) {
      report.clients = await Client.countDocuments({ planner: plannerId });
    }

    if (metrics.includes("revenue")) {
      const revenue = await Event.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$budget.amount" } } },
      ]);
      report.revenue = revenue[0]?.total || 0;
    }

    res.status(200).json({
      status: "success",
      data: {
        report,
        period: { startDate, endDate },
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};
