import User from "../models/user.model.js";
import Event from "../models/event.model.js";
import Payment from "../models/payment.model.js";
import Subscription from "../models/subscription.model.js";
import Vendor from "../models/vendor.model.js";
import SupportTicket from "../models/supportTicket.model.js";
import Content from "../models/content.model.js";
import mongoose from "mongoose";

/**
 * Admin Dashboard Service
 * Handles all dashboard metrics and analytics calculations
 */
class AdminDashboardService {
  /**
   * Get comprehensive dashboard metrics
   * @param {Object} options - Query options (dateRange, filters, etc.)
   * @returns {Object} Dashboard metrics
   */
  async getDashboardMetrics(options = {}) {
    const { startDate, endDate } = options;

    // Build date filter if provided
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Run all metrics queries in parallel for better performance
    const [
      userMetrics,
      eventMetrics,
      revenueMetrics,
      subscriptionMetrics,
      pendingActions,
      systemHealth,
      recentActivity,
    ] = await Promise.all([
      this.getUserMetrics(dateFilter),
      this.getEventMetrics(dateFilter),
      this.getRevenueMetrics(dateFilter),
      this.getSubscriptionMetrics(dateFilter),
      this.getPendingActions(),
      this.getSystemHealth(),
      this.getRecentActivity(10),
    ]);

    return {
      users: userMetrics,
      events: eventMetrics,
      revenue: revenueMetrics,
      subscriptions: subscriptionMetrics,
      pendingActions,
      systemHealth,
      recentActivity,
      timestamp: new Date(),
    };
  }

  /**
   * Get user-related metrics
   */
  async getUserMetrics(dateFilter = {}) {
    const [
      totalUsers,
      totalVendors,
      totalPlanners,
      totalGuests,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      userGrowth,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "vendor" }),
      User.countDocuments({ role: "event-planner" }),
      User.countDocuments({ role: "guest" }),
      User.countDocuments({ status: "active", isActive: true }),
      User.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      User.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      }),
      User.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      }),
      this.getUserGrowthTrend(),
    ]);

    return {
      total: totalUsers,
      vendors: totalVendors,
      planners: totalPlanners,
      guests: totalGuests,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      newToday: newUsersToday,
      newThisWeek: newUsersThisWeek,
      newThisMonth: newUsersThisMonth,
      growth: userGrowth,
    };
  }

  /**
   * Get event-related metrics
   */
  async getEventMetrics(dateFilter = {}) {
    const now = new Date();

    const [
      totalEvents,
      upcomingEvents,
      ongoingEvents,
      completedEvents,
      cancelledEvents,
      eventsToday,
      eventsThisWeek,
      eventsThisMonth,
      eventGrowth,
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({
        startDate: { $gt: now },
        status: { $ne: "cancelled" },
      }),
      Event.countDocuments({
        startDate: { $lte: now },
        endDate: { $gte: now },
        status: "active",
      }),
      Event.countDocuments({ status: "completed" }),
      Event.countDocuments({ status: "cancelled" }),
      Event.countDocuments({
        createdAt: {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
        },
      }),
      Event.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      }),
      Event.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      }),
      this.getEventGrowthTrend(),
    ]);

    return {
      total: totalEvents,
      upcoming: upcomingEvents,
      ongoing: ongoingEvents,
      completed: completedEvents,
      cancelled: cancelledEvents,
      createdToday: eventsToday,
      createdThisWeek: eventsThisWeek,
      createdThisMonth: eventsThisMonth,
      growth: eventGrowth,
    };
  }

  /**
   * Get revenue-related metrics
   */
  async getRevenueMetrics(dateFilter = {}) {
    const [totalRevenue, monthlyRevenue, revenueByTier, revenueTrend] =
      await Promise.all([
        Payment.aggregate([
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Payment.aggregate([
          {
            $match: {
              status: "completed",
              createdAt: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        this.getRevenueByTier(),
        this.getRevenueTrend(),
      ]);

    return {
      total: totalRevenue[0]?.total || 0,
      monthly: monthlyRevenue[0]?.total || 0,
      byTier: revenueByTier,
      trend: revenueTrend,
    };
  }

  /**
   * Get subscription-related metrics
   */
  async getSubscriptionMetrics(dateFilter = {}) {
    const [
      totalSubscriptions,
      activeSubscriptions,
      cancelledSubscriptions,
      expiredSubscriptions,
      subscriptionsByTier,
    ] = await Promise.all([
      Subscription.countDocuments(),
      Subscription.countDocuments({ status: "active" }),
      Subscription.countDocuments({ status: "cancelled" }),
      Subscription.countDocuments({ status: "expired" }),
      Subscription.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: "$tier", count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total: totalSubscriptions,
      active: activeSubscriptions,
      cancelled: cancelledSubscriptions,
      expired: expiredSubscriptions,
      byTier: subscriptionsByTier,
    };
  }

  /**
   * Get pending actions count
   */
  async getPendingActions() {
    const [pendingVerifications, openTickets, flaggedContent, failedPayments] =
      await Promise.all([
        Vendor.countDocuments({ verificationStatus: "pending" }),
        SupportTicket.countDocuments({
          status: { $in: ["open", "in-progress"] },
        }),
        Content.countDocuments({ moderationStatus: "pending" }),
        Payment.countDocuments({ status: "failed" }),
      ]);

    return {
      pendingVerifications,
      openTickets,
      flaggedContent,
      failedPayments,
      total:
        pendingVerifications + openTickets + flaggedContent + failedPayments,
    };
  }

  /**
   * Get system health indicators
   */
  async getSystemHealth() {
    try {
      // Check database connection
      const dbStatus =
        mongoose.connection.readyState === 1 ? "healthy" : "unhealthy";

      // Get database stats
      const dbStats = await mongoose.connection.db.stats();

      // Calculate API response time (simplified - in production use APM tools)
      const startTime = Date.now();
      await User.findOne().limit(1);
      const responseTime = Date.now() - startTime;

      // Get error rate (last hour) - simplified
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const errorCount = 0; // TODO: Implement error logging and counting

      return {
        database: {
          status: dbStatus,
          size: dbStats.dataSize,
          collections: dbStats.collections,
          indexes: dbStats.indexes,
        },
        api: {
          responseTime: `${responseTime}ms`,
          errorRate: errorCount,
        },
        uptime: process.uptime(),
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        database: { status: "error", error: error.message },
        api: { status: "error" },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get recent platform activity
   */
  async getRecentActivity(limit = 10) {
    const [recentUsers, recentEvents, recentPayments] = await Promise.all([
      User.find()
        .sort("-createdAt")
        .limit(limit)
        .select("email firstName lastName role createdAt"),
      Event.find()
        .sort("-createdAt")
        .limit(limit)
        .select("name eventType createdAt")
        .populate("organizer", "email firstName lastName"),
      Payment.find()
        .sort("-createdAt")
        .limit(limit)
        .select("amount status createdAt")
        .populate("user", "email firstName lastName"),
    ]);

    // Combine and sort all activities
    const activities = [
      ...recentUsers.map((user) => ({
        type: "user_registered",
        user: user.email,
        description: `${user.fullName} registered as ${user.role}`,
        timestamp: user.createdAt,
      })),
      ...recentEvents.map((event) => ({
        type: "event_created",
        user: event.organizer?.email,
        description: `Created event: ${event.name}`,
        timestamp: event.createdAt,
      })),
      ...recentPayments.map((payment) => ({
        type: "payment_received",
        user: payment.user?.email,
        description: `Payment of $${payment.amount} ${payment.status}`,
        timestamp: payment.createdAt,
      })),
    ];

    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * Get user growth trend (last 12 months)
   */
  async getUserGrowthTrend() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const growth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    return growth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      count: item.count,
    }));
  }

  /**
   * Get event growth trend (last 12 months)
   */
  async getEventGrowthTrend() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const growth = await Event.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    return growth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      count: item.count,
    }));
  }

  /**
   * Get revenue trend (last 12 months)
   */
  async getRevenueTrend() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const trend = await Payment.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    return trend.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      revenue: item.revenue,
      transactions: item.count,
    }));
  }

  /**
   * Get revenue by subscription tier
   */
  async getRevenueByTier() {
    const revenue = await Payment.aggregate([
      {
        $match: { status: "completed" },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "subscription",
          foreignField: "_id",
          as: "subscriptionData",
        },
      },
      {
        $unwind: {
          path: "$subscriptionData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$subscriptionData.tier",
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    return revenue.map((item) => ({
      tier: item._id || "one-time",
      revenue: item.revenue,
      transactions: item.count,
    }));
  }
}

export default new AdminDashboardService();
