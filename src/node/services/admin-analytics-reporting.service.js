import User from "../models/user.model.js";
import Event from "../models/event.model.js";
import Payment from "../models/payment.model.js";
import Subscription from "../models/subscription.model.js";
import Vendor from "../models/vendor.model.js";
import SupportTicket from "../models/supportTicket.model.js";
import FlaggedContent from "../models/flaggedContent.model.js";
import { createError } from "../utils/error.js";

/**
 * Admin Analytics & Reporting Service
 * Handles comprehensive analytics and custom reporting
 */
class AdminAnalyticsReportingService {
  /**
   * Get user analytics
   * @param {Object} options - Analytics options
   * @returns {Object} User analytics
   */
  async getUserAnalytics(options = {}) {
    const { startDate, endDate } = options;

    const matchStage = {};
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const [
      totalUsers,
      userGrowth,
      usersByRole,
      usersByStatus,
      activeUsers,
      retentionRate,
      churnRate,
      topUsers,
    ] = await Promise.all([
      User.countDocuments(matchStage),
      this.getUserGrowthTrend(startDate, endDate),
      User.aggregate([
        { $match: matchStage },
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      User.countDocuments({ ...matchStage, isActive: true }),
      this.calculateRetentionRate(startDate, endDate),
      this.calculateChurnRate(startDate, endDate),
      this.getTopUsers(10),
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      growth: userGrowth,
      byRole: usersByRole,
      byStatus: usersByStatus,
      retentionRate,
      churnRate,
      topUsers,
    };
  }

  /**
   * Get event analytics
   * @param {Object} options - Analytics options
   * @returns {Object} Event analytics
   */
  async getEventAnalytics(options = {}) {
    const { startDate, endDate } = options;

    const matchStage = {};
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const [
      totalEvents,
      eventsByType,
      eventsByStatus,
      averageBudget,
      completionRate,
      eventTrends,
      popularEventTypes,
    ] = await Promise.all([
      Event.countDocuments(matchStage),
      Event.aggregate([
        { $match: matchStage },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Event.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.calculateAverageBudget(matchStage),
      this.calculateCompletionRate(matchStage),
      this.getEventTrends(startDate, endDate),
      this.getPopularEventTypes(10),
    ]);

    return {
      total: totalEvents,
      byType: eventsByType,
      byStatus: eventsByStatus,
      averageBudget,
      completionRate,
      trends: eventTrends,
      popularTypes: popularEventTypes,
    };
  }

  /**
   * Get financial analytics
   * @param {Object} options - Analytics options
   * @returns {Object} Financial analytics
   */
  async getFinancialAnalytics(options = {}) {
    const { startDate, endDate } = options;

    const matchStage = { status: "completed" };
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const [
      totalRevenue,
      revenueByType,
      revenueByMethod,
      revenueTrends,
      averageTransactionValue,
      topRevenueUsers,
      monthlyRecurringRevenue,
      projectedRevenue,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: matchStage },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$paymentType",
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$paymentMethod",
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      this.getRevenueTrends(startDate, endDate),
      Payment.aggregate([
        { $match: matchStage },
        { $group: { _id: null, avg: { $avg: "$amount" } } },
      ]),
      this.getTopRevenueUsers(10),
      this.calculateMRR(),
      this.projectRevenue(),
    ]);

    return {
      totalRevenue: totalRevenue[0]?.total || 0,
      byType: revenueByType,
      byMethod: revenueByMethod,
      trends: revenueTrends,
      averageTransactionValue: averageTransactionValue[0]?.avg || 0,
      topUsers: topRevenueUsers,
      mrr: monthlyRecurringRevenue,
      projected: projectedRevenue,
    };
  }

  /**
   * Get engagement analytics
   * @param {Object} options - Analytics options
   * @returns {Object} Engagement analytics
   */
  async getEngagementAnalytics(options = {}) {
    const { startDate, endDate } = options;

    const [
      dailyActiveUsers,
      monthlyActiveUsers,
      averageSessionDuration,
      featureUsage,
      userEngagementScore,
    ] = await Promise.all([
      this.calculateDAU(startDate, endDate),
      this.calculateMAU(startDate, endDate),
      this.calculateAverageSessionDuration(),
      this.getFeatureUsage(),
      this.calculateEngagementScore(),
    ]);

    return {
      dau: dailyActiveUsers,
      mau: monthlyActiveUsers,
      averageSessionDuration,
      featureUsage,
      engagementScore: userEngagementScore,
    };
  }

  /**
   * Generate custom report
   * @param {Object} config - Report configuration
   * @returns {Object} Custom report data
   */
  async generateCustomReport(config) {
    const { metrics, filters, dateRange, groupBy } = config;

    const results = {};

    // Process each requested metric
    for (const metric of metrics) {
      switch (metric) {
        case "users":
          results.users = await this.getUserAnalytics(dateRange);
          break;
        case "events":
          results.events = await this.getEventAnalytics(dateRange);
          break;
        case "revenue":
          results.revenue = await this.getFinancialAnalytics(dateRange);
          break;
        case "engagement":
          results.engagement = await this.getEngagementAnalytics(dateRange);
          break;
        case "subscriptions":
          results.subscriptions = await this.getSubscriptionAnalytics(
            dateRange
          );
          break;
        case "support":
          results.support = await this.getSupportAnalytics(dateRange);
          break;
        default:
          break;
      }
    }

    return {
      config,
      data: results,
      generatedAt: new Date(),
    };
  }

  /**
   * Get user growth trend
   * @param {String} startDate - Start date
   * @param {String} endDate - End date
   * @returns {Array} Growth trend
   */
  async getUserGrowthTrend(startDate, endDate) {
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const growth = await User.aggregate([
      { $match: matchStage },
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

    return growth;
  }

  /**
   * Calculate retention rate
   * @param {String} startDate - Start date
   * @param {String} endDate - End date
   * @returns {Number} Retention rate percentage
   */
  async calculateRetentionRate(startDate, endDate) {
    // Simplified retention calculation
    // In production, implement cohort-based retention
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers] = await Promise.all([
      User.countDocuments({ createdAt: { $lte: thirtyDaysAgo } }),
      User.countDocuments({
        createdAt: { $lte: thirtyDaysAgo },
        lastLogin: { $gte: thirtyDaysAgo },
      }),
    ]);

    if (totalUsers === 0) return 0;
    return Math.round((activeUsers / totalUsers) * 100 * 100) / 100;
  }

  /**
   * Calculate churn rate
   * @param {String} startDate - Start date
   * @param {String} endDate - End date
   * @returns {Number} Churn rate percentage
   */
  async calculateChurnRate(startDate, endDate) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, churnedUsers] = await Promise.all([
      User.countDocuments({ createdAt: { $lte: thirtyDaysAgo } }),
      User.countDocuments({
        createdAt: { $lte: thirtyDaysAgo },
        status: { $in: ["suspended", "deleted"] },
      }),
    ]);

    if (totalUsers === 0) return 0;
    return Math.round((churnedUsers / totalUsers) * 100 * 100) / 100;
  }

  /**
   * Get top users by activity
   * @param {Number} limit - Number of users to return
   * @returns {Array} Top users
   */
  async getTopUsers(limit = 10) {
    const topUsers = await Event.aggregate([
      {
        $group: {
          _id: "$organizer",
          eventCount: { $sum: 1 },
        },
      },
      { $sort: { eventCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
    ]);

    return topUsers;
  }

  /**
   * Calculate average budget
   * @param {Object} matchStage - Match stage for aggregation
   * @returns {Number} Average budget
   */
  async calculateAverageBudget(matchStage) {
    const result = await Event.aggregate([
      { $match: matchStage },
      { $match: { "budget.total": { $exists: true, $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$budget.total" } } },
    ]);

    return result[0]?.avg || 0;
  }

  /**
   * Calculate completion rate
   * @param {Object} matchStage - Match stage for aggregation
   * @returns {Number} Completion rate percentage
   */
  async calculateCompletionRate(matchStage) {
    const results = await Event.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
    ]);

    if (!results[0] || results[0].total === 0) return 0;
    return (
      Math.round((results[0].completed / results[0].total) * 100 * 100) / 100
    );
  }

  /**
   * Get event trends
   * @param {String} startDate - Start date
   * @param {String} endDate - End date
   * @returns {Array} Event trends
   */
  async getEventTrends(startDate, endDate) {
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const trends = await Event.aggregate([
      { $match: matchStage },
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

    return trends;
  }

  /**
   * Get popular event types
   * @param {Number} limit - Number of types to return
   * @returns {Array} Popular event types
   */
  async getPopularEventTypes(limit = 10) {
    const types = await Event.aggregate([
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 },
          avgBudget: { $avg: "$budget.total" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return types;
  }

  /**
   * Get revenue trends
   * @param {String} startDate - Start date
   * @param {String} endDate - End date
   * @returns {Array} Revenue trends
   */
  async getRevenueTrends(startDate, endDate) {
    const matchStage = { status: "completed" };
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const trends = await Payment.aggregate([
      { $match: matchStage },
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
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return trends;
  }

  /**
   * Get top revenue users
   * @param {Number} limit - Number of users to return
   * @returns {Array} Top revenue users
   */
  async getTopRevenueUsers(limit = 10) {
    const topUsers = await Payment.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$user",
          totalSpent: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
    ]);

    return topUsers;
  }

  /**
   * Calculate Monthly Recurring Revenue (MRR)
   * @returns {Number} MRR
   */
  async calculateMRR() {
    const activeSubscriptions = await Subscription.aggregate([
      { $match: { status: "active", billingCycle: "monthly" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const yearlySubscriptions = await Subscription.aggregate([
      { $match: { status: "active", billingCycle: "yearly" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const monthlyMRR = activeSubscriptions[0]?.total || 0;
    const yearlyMRR = (yearlySubscriptions[0]?.total || 0) / 12;

    return Math.round((monthlyMRR + yearlyMRR) * 100) / 100;
  }

  /**
   * Project revenue for next period
   * @returns {Object} Projected revenue
   */
  async projectRevenue() {
    const mrr = await this.calculateMRR();
    const growthRate = await this.calculateGrowthRate();

    return {
      nextMonth: Math.round(mrr * (1 + growthRate / 100) * 100) / 100,
      nextQuarter: Math.round(mrr * 3 * (1 + growthRate / 100) * 100) / 100,
      nextYear: Math.round(mrr * 12 * (1 + growthRate / 100) * 100) / 100,
    };
  }

  /**
   * Calculate growth rate
   * @returns {Number} Growth rate percentage
   */
  async calculateGrowthRate() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const [lastMonthRevenue, previousMonthRevenue] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            status: "completed",
            createdAt: { $gte: lastMonth, $lt: now },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            status: "completed",
            createdAt: { $gte: twoMonthsAgo, $lt: lastMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const last = lastMonthRevenue[0]?.total || 0;
    const previous = previousMonthRevenue[0]?.total || 0;

    if (previous === 0) return 0;
    return Math.round(((last - previous) / previous) * 100 * 100) / 100;
  }

  /**
   * Calculate Daily Active Users (DAU)
   * @param {String} startDate - Start date
   * @param {String} endDate - End date
   * @returns {Number} DAU
   */
  async calculateDAU(startDate, endDate) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const dau = await User.countDocuments({
      lastLogin: { $gte: yesterday },
    });

    return dau;
  }

  /**
   * Calculate Monthly Active Users (MAU)
   * @param {String} startDate - Start date
   * @param {String} endDate - End date
   * @returns {Number} MAU
   */
  async calculateMAU(startDate, endDate) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const mau = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo },
    });

    return mau;
  }

  /**
   * Calculate average session duration
   * @returns {Number} Average session duration in minutes
   */
  async calculateAverageSessionDuration() {
    // TODO: Implement session tracking
    // For now, return placeholder
    return 0;
  }

  /**
   * Get feature usage statistics
   * @returns {Object} Feature usage
   */
  async getFeatureUsage() {
    const [eventsCreated, vendorsBooked, aiPlannerUsed, guestsManaged] =
      await Promise.all([
        Event.countDocuments(),
        // TODO: Implement booking tracking
        Promise.resolve(0),
        // TODO: Implement AI planner usage tracking
        Promise.resolve(0),
        // TODO: Implement guest management tracking
        Promise.resolve(0),
      ]);

    return {
      eventsCreated,
      vendorsBooked,
      aiPlannerUsed,
      guestsManaged,
    };
  }

  /**
   * Calculate engagement score
   * @returns {Number} Engagement score (0-100)
   */
  async calculateEngagementScore() {
    const [dau, mau] = await Promise.all([
      this.calculateDAU(),
      this.calculateMAU(),
    ]);

    if (mau === 0) return 0;
    return Math.round((dau / mau) * 100 * 100) / 100;
  }

  /**
   * Get subscription analytics
   * @param {Object} dateRange - Date range
   * @returns {Object} Subscription analytics
   */
  async getSubscriptionAnalytics(dateRange) {
    const matchStage = {};
    if (dateRange?.startDate && dateRange?.endDate) {
      matchStage.createdAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate),
      };
    }

    const [total, byStatus, byTier, mrr] = await Promise.all([
      Subscription.countDocuments(matchStage),
      Subscription.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Subscription.aggregate([
        { $match: matchStage },
        { $group: { _id: "$planName", count: { $sum: 1 } } },
      ]),
      this.calculateMRR(),
    ]);

    return {
      total,
      byStatus,
      byTier,
      mrr,
    };
  }

  /**
   * Get support analytics
   * @param {Object} dateRange - Date range
   * @returns {Object} Support analytics
   */
  async getSupportAnalytics(dateRange) {
    const matchStage = {};
    if (dateRange?.startDate && dateRange?.endDate) {
      matchStage.createdAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate),
      };
    }

    const [total, byStatus, byPriority, avgSatisfaction] = await Promise.all([
      SupportTicket.countDocuments(matchStage),
      SupportTicket.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $match: matchStage },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $match: { ...matchStage, "satisfaction.rating": { $exists: true } } },
        { $group: { _id: null, avg: { $avg: "$satisfaction.rating" } } },
      ]),
    ]);

    return {
      total,
      byStatus,
      byPriority,
      avgSatisfaction: avgSatisfaction[0]?.avg || 0,
    };
  }
}

export default new AdminAnalyticsReportingService();
