import Event from "../models/event.model.js";
import Task from "../models/task.model.js";
import Vendor from "../models/vendor.model.js";
import { logger } from "../utils/logger.js";

/**
 * Analytics Service
 * Calculates metrics and generates reports
 */
class AnalyticsService {
  /**
   * Calculate event performance metrics
   */
  async calculateEventMetrics(plannerId, dateRange = {}) {
    try {
      const query = { planner: plannerId };

      if (dateRange.startDate || dateRange.endDate) {
        query.startDate = {};
        if (dateRange.startDate)
          query.startDate.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate)
          query.startDate.$lte = new Date(dateRange.endDate);
      }

      const events = await Event.find(query).lean();

      const metrics = {
        totalEvents: events.length,
        byStatus: {
          draft: events.filter((e) => e.status === "draft").length,
          published: events.filter((e) => e.status === "published").length,
          completed: events.filter((e) => e.status === "completed").length,
          cancelled: events.filter((e) => e.status === "cancelled").length,
        },
        byType: {},
        averageGuestCount: 0,
        totalGuests: 0,
        averageBudget: 0,
        totalBudget: 0,
        completionRate: 0,
        upcomingEvents: 0,
        pastEvents: 0,
      };

      // Calculate by type
      events.forEach((event) => {
        if (!metrics.byType[event.eventType]) {
          metrics.byType[event.eventType] = 0;
        }
        metrics.byType[event.eventType]++;
      });

      // Calculate guest and budget metrics
      const eventsWithGuests = events.filter((e) => e.guestCount);
      const eventsWithBudget = events.filter((e) => e.budget?.amount);

      if (eventsWithGuests.length > 0) {
        metrics.totalGuests = eventsWithGuests.reduce(
          (sum, e) => sum + e.guestCount,
          0
        );
        metrics.averageGuestCount = Math.round(
          metrics.totalGuests / eventsWithGuests.length
        );
      }

      if (eventsWithBudget.length > 0) {
        metrics.totalBudget = eventsWithBudget.reduce(
          (sum, e) => sum + e.budget.amount,
          0
        );
        metrics.averageBudget = Math.round(
          metrics.totalBudget / eventsWithBudget.length
        );
      }

      // Calculate completion rate
      const completableEvents = events.filter((e) => e.status !== "draft");
      if (completableEvents.length > 0) {
        const completed = completableEvents.filter(
          (e) => e.status === "completed"
        ).length;
        metrics.completionRate = Math.round(
          (completed / completableEvents.length) * 100
        );
      }

      // Calculate upcoming vs past
      const now = new Date();
      metrics.upcomingEvents = events.filter(
        (e) => new Date(e.startDate) > now
      ).length;
      metrics.pastEvents = events.filter(
        (e) => new Date(e.endDate) < now
      ).length;

      return metrics;
    } catch (error) {
      logger.error("Failed to calculate event metrics", { error, plannerId });
      throw error;
    }
  }

  /**
   * Calculate financial metrics
   */
  async calculateFinancialMetrics(plannerId, dateRange = {}) {
    try {
      const query = { planner: plannerId };

      if (dateRange.startDate || dateRange.endDate) {
        query.startDate = {};
        if (dateRange.startDate)
          query.startDate.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate)
          query.startDate.$lte = new Date(dateRange.endDate);
      }

      const events = await Event.find(query).lean();

      const metrics = {
        totalRevenue: 0,
        totalExpenses: 0,
        totalProfit: 0,
        profitMargin: 0,
        averageEventRevenue: 0,
        averageEventExpenses: 0,
        byEventType: {},
        byCurrency: {},
        pendingPayments: 0,
        paidAmount: 0,
      };

      events.forEach((event) => {
        const budget = event.budget?.amount || 0;
        const currency = event.budget?.currency || "NGN";

        // Aggregate by currency
        if (!metrics.byCurrency[currency]) {
          metrics.byCurrency[currency] = {
            revenue: 0,
            expenses: 0,
            profit: 0,
          };
        }

        metrics.byCurrency[currency].revenue += budget;
        metrics.totalRevenue += budget;

        // Aggregate by event type
        if (!metrics.byEventType[event.eventType]) {
          metrics.byEventType[event.eventType] = {
            revenue: 0,
            expenses: 0,
            profit: 0,
            count: 0,
          };
        }

        metrics.byEventType[event.eventType].revenue += budget;
        metrics.byEventType[event.eventType].count++;
      });

      // Calculate averages
      if (events.length > 0) {
        metrics.averageEventRevenue = Math.round(
          metrics.totalRevenue / events.length
        );
      }

      // Calculate profit (simplified - would need expense tracking)
      metrics.totalProfit = metrics.totalRevenue - metrics.totalExpenses;
      if (metrics.totalRevenue > 0) {
        metrics.profitMargin = Math.round(
          (metrics.totalProfit / metrics.totalRevenue) * 100
        );
      }

      return metrics;
    } catch (error) {
      logger.error("Failed to calculate financial metrics", {
        error,
        plannerId,
      });
      throw error;
    }
  }

  /**
   * Calculate vendor performance metrics
   */
  async calculateVendorMetrics(plannerId, dateRange = {}) {
    try {
      const query = { planner: plannerId };

      if (dateRange.startDate || dateRange.endDate) {
        query.startDate = {};
        if (dateRange.startDate)
          query.startDate.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate)
          query.startDate.$lte = new Date(dateRange.endDate);
      }

      const events = await Event.find(query).populate("vendors.vendor").lean();

      const vendorStats = {};
      let totalVendors = 0;

      events.forEach((event) => {
        if (event.vendors && event.vendors.length > 0) {
          event.vendors.forEach((v) => {
            if (v.vendor) {
              const vendorId = v.vendor._id.toString();

              if (!vendorStats[vendorId]) {
                vendorStats[vendorId] = {
                  vendor: v.vendor,
                  eventsCount: 0,
                  totalSpent: 0,
                  averageRating: 0,
                  statuses: {
                    pending: 0,
                    accepted: 0,
                    rejected: 0,
                    completed: 0,
                  },
                };
                totalVendors++;
              }

              vendorStats[vendorId].eventsCount++;
              vendorStats[vendorId].statuses[v.status]++;

              if (v.contract?.amount) {
                vendorStats[vendorId].totalSpent += v.contract.amount;
              }
            }
          });
        }
      });

      // Convert to array and sort by events count
      const topVendors = Object.values(vendorStats)
        .sort((a, b) => b.eventsCount - a.eventsCount)
        .slice(0, 10);

      const metrics = {
        totalVendors,
        topVendors,
        averageVendorsPerEvent:
          events.length > 0
            ? Math.round(
                Object.values(vendorStats).reduce(
                  (sum, v) => sum + v.eventsCount,
                  0
                ) / events.length
              )
            : 0,
      };

      return metrics;
    } catch (error) {
      logger.error("Failed to calculate vendor metrics", { error, plannerId });
      throw error;
    }
  }

  /**
   * Calculate client metrics
   */
  async calculateClientMetrics(plannerId, dateRange = {}) {
    try {
      const query = { planner: plannerId };

      if (dateRange.startDate || dateRange.endDate) {
        query.startDate = {};
        if (dateRange.startDate)
          query.startDate.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate)
          query.startDate.$lte = new Date(dateRange.endDate);
      }

      const events = await Event.find(query).populate("client").lean();

      const clientStats = {};
      let totalClients = 0;

      events.forEach((event) => {
        if (event.client) {
          const clientId = event.client._id.toString();

          if (!clientStats[clientId]) {
            clientStats[clientId] = {
              client: event.client,
              eventsCount: 0,
              totalSpent: 0,
              averageBudget: 0,
            };
            totalClients++;
          }

          clientStats[clientId].eventsCount++;

          if (event.budget?.amount) {
            clientStats[clientId].totalSpent += event.budget.amount;
          }
        }
      });

      // Calculate averages and sort
      Object.values(clientStats).forEach((stat) => {
        if (stat.eventsCount > 0) {
          stat.averageBudget = Math.round(stat.totalSpent / stat.eventsCount);
        }
      });

      const topClients = Object.values(clientStats)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      const metrics = {
        totalClients,
        topClients,
        averageEventsPerClient:
          totalClients > 0 ? Math.round(events.length / totalClients) : 0,
        repeatClientRate:
          totalClients > 0
            ? Math.round(
                (Object.values(clientStats).filter((c) => c.eventsCount > 1)
                  .length /
                  totalClients) *
                  100
              )
            : 0,
      };

      return metrics;
    } catch (error) {
      logger.error("Failed to calculate client metrics", { error, plannerId });
      throw error;
    }
  }

  /**
   * Calculate task completion metrics
   */
  async calculateTaskMetrics(plannerId, dateRange = {}) {
    try {
      const query = { planner: plannerId };

      if (dateRange.startDate || dateRange.endDate) {
        query.dueDate = {};
        if (dateRange.startDate)
          query.dueDate.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate) query.dueDate.$lte = new Date(dateRange.endDate);
      }

      const tasks = await Task.find(query).lean();

      const metrics = {
        totalTasks: tasks.length,
        byStatus: {
          todo: tasks.filter((t) => t.status === "todo").length,
          "in-progress": tasks.filter((t) => t.status === "in-progress").length,
          completed: tasks.filter((t) => t.status === "completed").length,
          cancelled: tasks.filter((t) => t.status === "cancelled").length,
        },
        byPriority: {
          low: tasks.filter((t) => t.priority === "low").length,
          medium: tasks.filter((t) => t.priority === "medium").length,
          high: tasks.filter((t) => t.priority === "high").length,
          urgent: tasks.filter((t) => t.priority === "urgent").length,
        },
        completionRate: 0,
        overdueTasks: 0,
        averageCompletionTime: 0,
      };

      // Calculate completion rate
      if (tasks.length > 0) {
        const completed = tasks.filter((t) => t.status === "completed").length;
        metrics.completionRate = Math.round((completed / tasks.length) * 100);
      }

      // Calculate overdue tasks
      const now = new Date();
      metrics.overdueTasks = tasks.filter(
        (t) =>
          t.dueDate && new Date(t.dueDate) < now && t.status !== "completed"
      ).length;

      return metrics;
    } catch (error) {
      logger.error("Failed to calculate task metrics", { error, plannerId });
      throw error;
    }
  }

  /**
   * Generate dashboard summary
   */
  async generateDashboardSummary(plannerId, dateRange = {}) {
    try {
      const [eventMetrics, financialMetrics, taskMetrics] = await Promise.all([
        this.calculateEventMetrics(plannerId, dateRange),
        this.calculateFinancialMetrics(plannerId, dateRange),
        this.calculateTaskMetrics(plannerId, dateRange),
      ]);

      return {
        events: eventMetrics,
        financial: financialMetrics,
        tasks: taskMetrics,
        generatedAt: new Date(),
        dateRange,
      };
    } catch (error) {
      logger.error("Failed to generate dashboard summary", {
        error,
        plannerId,
      });
      throw error;
    }
  }
}

export default new AnalyticsService();
