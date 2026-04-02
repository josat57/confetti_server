import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";

/**
 * Admin Subscription & Billing Service
 * Handles subscription and billing management for admin dashboard
 */
class AdminSubscriptionBillingService {
  /**
   * Get subscriptions with pagination and filters
   * @param {Object} options - Query options
   * @returns {Object} Paginated subscriptions
   */
  async getSubscriptions(options = {}) {
    const {
      page = 1,
      limit = 20,
      status = "",
      planType = "",
      planName = "",
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Plan type filter
    if (planType) {
      query.planType = planType;
    }

    // Plan name filter
    if (planName) {
      query.planName = planName;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    let subscriptions;
    let total;

    if (search) {
      // If search is provided, we need to search by user email/name
      const users = await User.find({
        $or: [
          { email: { $regex: search, $options: "i" } },
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const userIds = users.map((u) => u._id);
      query.user = { $in: userIds };

      [subscriptions, total] = await Promise.all([
        Subscription.find(query)
          .populate("user", "email firstName lastName")
          .populate("currentPaymentId")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Subscription.countDocuments(query),
      ]);
    } else {
      [subscriptions, total] = await Promise.all([
        Subscription.find(query)
          .populate("user", "email firstName lastName")
          .populate("currentPaymentId")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Subscription.countDocuments(query),
      ]);
    }

    return {
      subscriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get subscription by ID with full details
   * @param {String} subscriptionId - Subscription ID
   * @returns {Object} Subscription details
   */
  async getSubscriptionById(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId)
      .populate("user", "email firstName lastName phone status")
      .populate("currentPaymentId")
      .populate("paymentHistory.payment")
      .lean();

    if (!subscription) {
      throw createError(404, "Subscription not found");
    }

    // Get all payments for this subscription
    const payments = await Payment.find({ subscription: subscriptionId })
      .sort("-createdAt")
      .lean();

    // Get usage statistics
    const usageStats = {
      eventsCreated: subscription.usage?.eventsCreated || 0,
      photosUploaded: subscription.usage?.photosUploaded || 0,
      lastResetDate: subscription.usage?.lastResetDate,
    };

    return {
      ...subscription,
      payments,
      usageStats,
    };
  }

  /**
   * Manually upgrade subscription
   * @param {String} subscriptionId - Subscription ID
   * @param {String} newPlanName - New plan name
   * @param {String} adminId - Admin ID
   * @returns {Object} Updated subscription with prorated amount
   */
  async upgradeSubscription(subscriptionId, newPlanName, adminId) {
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw createError(404, "Subscription not found");
    }

    if (subscription.status !== "active") {
      throw createError(400, "Can only upgrade active subscriptions");
    }

    // Get new plan details
    const newPlan = await SubscriptionPlan.findByTypeAndName(
      subscription.planType,
      newPlanName
    );

    if (!newPlan) {
      throw createError(404, "New plan not found");
    }

    // Get pricing for user's currency
    const pricing = newPlan.getPriceForCurrency(subscription.currency);
    if (!pricing) {
      throw createError(400, "Pricing not available for this currency");
    }

    // Calculate prorated amount
    const prorationDetails = subscription.calculateProration(pricing.amount);

    // Store previous plan
    const previousPlan = subscription.planName;
    const previousAmount = subscription.amount;

    // Update subscription
    subscription.planName = newPlanName;
    subscription.amount = pricing.amount;
    subscription.history.push({
      planName: newPlanName,
      status: subscription.status,
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: pricing.amount,
      changeType: "upgrade",
      proratedAmount: prorationDetails.amountDue,
      reason: "Admin manual upgrade",
    });

    await subscription.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "upgrade_subscription",
      resource: "subscription",
      resourceId: subscriptionId,
      changes: {
        planName: { from: previousPlan, to: newPlanName },
        amount: { from: previousAmount, to: pricing.amount },
        prorationDetails,
      },
      timestamp: new Date(),
    });

    return {
      subscription,
      prorationDetails,
      amountDue: prorationDetails.amountDue,
    };
  }

  /**
   * Manually downgrade subscription
   * @param {String} subscriptionId - Subscription ID
   * @param {String} newPlanName - New plan name
   * @param {String} adminId - Admin ID
   * @returns {Object} Updated subscription
   */
  async downgradeSubscription(subscriptionId, newPlanName, adminId) {
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw createError(404, "Subscription not found");
    }

    // Get new plan details
    const newPlan = await SubscriptionPlan.findByTypeAndName(
      subscription.planType,
      newPlanName
    );

    if (!newPlan) {
      throw createError(404, "New plan not found");
    }

    // Get pricing
    const pricing = newPlan.getPriceForCurrency(subscription.currency);
    if (!pricing) {
      throw createError(400, "Pricing not available for this currency");
    }

    const previousPlan = subscription.planName;
    const previousAmount = subscription.amount;

    // Schedule downgrade for next billing cycle
    subscription.pendingUpgrade = {
      newPlanName: newPlanName,
      amount: pricing.amount,
    };

    subscription.history.push({
      planName: newPlanName,
      status: subscription.status,
      startDate: subscription.endDate, // Takes effect at end of current period
      endDate: new Date(
        subscription.endDate.getTime() + 30 * 24 * 60 * 60 * 1000
      ),
      amount: pricing.amount,
      changeType: "downgrade",
      reason: "Admin manual downgrade - scheduled for next billing cycle",
    });

    await subscription.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "downgrade_subscription",
      resource: "subscription",
      resourceId: subscriptionId,
      changes: {
        planName: { from: previousPlan, to: newPlanName },
        amount: { from: previousAmount, to: pricing.amount },
        effectiveDate: subscription.endDate,
      },
      timestamp: new Date(),
    });

    return subscription;
  }

  /**
   * Cancel subscription
   * @param {String} subscriptionId - Subscription ID
   * @param {String} adminId - Admin ID
   * @param {String} reason - Cancellation reason
   * @returns {Object} Updated subscription
   */
  async cancelSubscription(subscriptionId, adminId, reason = "") {
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw createError(404, "Subscription not found");
    }

    if (subscription.status === "cancelled") {
      throw createError(400, "Subscription is already cancelled");
    }

    const previousStatus = subscription.status;

    // Cancel subscription but maintain access until end date
    subscription.status = "cancelled";
    subscription.autoRenew = false;
    subscription.cancellationDetails = {
      cancelledAt: new Date(),
      reason: reason || "Admin cancellation",
    };

    subscription.history.push({
      planName: subscription.planName,
      status: "cancelled",
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: subscription.amount,
      changeType: "cancellation",
      reason: reason || "Admin cancellation",
    });

    await subscription.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "cancel_subscription",
      resource: "subscription",
      resourceId: subscriptionId,
      changes: {
        status: { from: previousStatus, to: "cancelled" },
        reason,
      },
      timestamp: new Date(),
    });

    return subscription;
  }

  /**
   * Issue refund for payment
   * @param {String} paymentId - Payment ID
   * @param {Number} amount - Refund amount
   * @param {String} reason - Refund reason
   * @param {String} adminId - Admin ID
   * @returns {Object} Updated payment
   */
  async issueRefund(paymentId, amount, reason, adminId) {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      throw createError(404, "Payment not found");
    }

    if (payment.status !== "completed") {
      throw createError(400, "Can only refund completed payments");
    }

    if (payment.status === "refunded") {
      throw createError(400, "Payment has already been refunded");
    }

    if (amount > payment.amount) {
      throw createError(400, "Refund amount cannot exceed payment amount");
    }

    // Update payment status
    payment.status = "refunded";
    payment.refundDetails = {
      refundAmount: amount,
      refundReason: reason,
      refundedAt: new Date(),
    };

    await payment.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "issue_refund",
      resource: "payment",
      resourceId: paymentId,
      changes: {
        status: { from: "completed", to: "refunded" },
        refundAmount: amount,
        reason,
      },
      timestamp: new Date(),
    });

    // TODO: Process actual refund through payment gateway
    // await paymentGatewayService.processRefund(payment, amount);

    return payment;
  }

  /**
   * Get failed payments
   * @param {Object} options - Query options
   * @returns {Object} Failed payments
   */
  async getFailedPayments(options = {}) {
    const { page = 1, limit = 20 } = options;

    const query = { status: "failed" };
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("user", "email firstName lastName")
        .populate("subscription")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(query),
    ]);

    return {
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retry failed payment
   * @param {String} paymentId - Payment ID
   * @param {String} adminId - Admin ID
   * @returns {Object} Result
   */
  async retryPayment(paymentId, adminId) {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      throw createError(404, "Payment not found");
    }

    if (payment.status !== "failed") {
      throw createError(400, "Can only retry failed payments");
    }

    // Increment retry attempts
    payment.requeryAttempts += 1;
    payment.lastRequeryAt = new Date();
    await payment.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "retry_payment",
      resource: "payment",
      resourceId: paymentId,
      changes: {
        requeryAttempts: payment.requeryAttempts,
      },
      timestamp: new Date(),
    });

    // TODO: Implement actual payment retry logic with payment gateway
    // const result = await paymentGatewayService.retryPayment(payment);

    return {
      success: true,
      message: "Payment retry initiated",
      payment,
    };
  }

  /**
   * Get subscription statistics
   * @returns {Object} Subscription statistics
   */
  async getSubscriptionStatistics() {
    const [
      totalSubscriptions,
      subscriptionsByStatus,
      subscriptionsByPlanType,
      subscriptionsByPlanName,
      revenueStats,
      expiringSubscriptions,
    ] = await Promise.all([
      Subscription.countDocuments(),
      Subscription.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Subscription.aggregate([
        { $group: { _id: "$planType", count: { $sum: 1 } } },
      ]),
      Subscription.aggregate([
        {
          $group: {
            _id: { planType: "$planType", planName: "$planName" },
            count: { $sum: 1 },
          },
        },
      ]),
      this.getRevenueStatistics(),
      Subscription.find({
        status: "active",
        endDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
        },
      })
        .populate("user", "email firstName lastName")
        .limit(20)
        .lean(),
    ]);

    return {
      total: totalSubscriptions,
      byStatus: subscriptionsByStatus,
      byPlanType: subscriptionsByPlanType,
      byPlanName: subscriptionsByPlanName,
      revenue: revenueStats,
      expiringSubscriptions,
    };
  }

  /**
   * Get revenue statistics
   * @returns {Object} Revenue statistics
   */
  async getRevenueStatistics() {
    const [monthlyRevenue, yearlyRevenue, revenueByPlan] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            status: "completed",
            paymentType: "subscription",
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        {
          $match: {
            status: "completed",
            paymentType: "subscription",
            createdAt: {
              $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        {
          $match: {
            status: "completed",
            paymentType: "subscription",
          },
        },
        {
          $group: {
            _id: "$subscriptionDetails.planName",
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    return {
      monthly: monthlyRevenue[0] || { total: 0, count: 0 },
      yearly: yearlyRevenue[0] || { total: 0, count: 0 },
      byPlan: revenueByPlan,
    };
  }

  /**
   * Export subscriptions data
   * @param {Object} filters - Export filters
   * @returns {Array} Subscriptions data
   */
  async exportSubscriptions(filters = {}) {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.planType) query.planType = filters.planType;
    if (filters.planName) query.planName = filters.planName;
    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const subscriptions = await Subscription.find(query)
      .populate("user", "email firstName lastName")
      .lean();

    return subscriptions.map((sub) => ({
      id: sub._id,
      userEmail: sub.user?.email,
      userName: `${sub.user?.firstName} ${sub.user?.lastName}`,
      planType: sub.planType,
      planName: sub.planName,
      status: sub.status,
      amount: sub.amount,
      currency: sub.currency,
      billingCycle: sub.billingCycle,
      startDate: sub.startDate,
      endDate: sub.endDate,
      autoRenew: sub.autoRenew,
      createdAt: sub.createdAt,
    }));
  }

  /**
   * Get revenue reports
   * @param {Object} options - Report options
   * @returns {Object} Revenue reports
   */
  async getRevenueReports(options = {}) {
    const { startDate, endDate, groupBy = "month" } = options;

    const matchStage = {
      status: "completed",
      paymentType: "subscription",
    };

    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const groupByField =
      groupBy === "day"
        ? {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          }
        : groupBy === "week"
        ? {
            year: { $year: "$createdAt" },
            week: { $week: "$createdAt" },
          }
        : {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          };

    const reports = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupByField,
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    return reports;
  }
}

export default new AdminSubscriptionBillingService();
