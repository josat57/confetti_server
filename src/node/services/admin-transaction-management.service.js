import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import Subscription from "../models/subscription.model.js";
import Event from "../models/event.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";

/**
 * Admin Transaction Management Service
 * Handles payment and transaction management for admin dashboard
 */
class AdminTransactionManagementService {
  /**
   * Get transactions with pagination and filters
   * @param {Object} options - Query options
   * @returns {Object} Paginated transactions
   */
  async getTransactions(options = {}) {
    const {
      page = 1,
      limit = 20,
      status = "",
      paymentType = "",
      paymentMethod = "",
      search = "",
      startDate = "",
      endDate = "",
      minAmount = "",
      maxAmount = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Payment type filter
    if (paymentType) {
      query.paymentType = paymentType;
    }

    // Payment method filter
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Date range filter
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    let transactions;
    let total;

    if (search) {
      // Search by transaction ID, reference, or user email
      const searchQuery = {
        $or: [
          { transactionId: { $regex: search, $options: "i" } },
          { reference: { $regex: search, $options: "i" } },
        ],
      };

      // Also search by user email
      const users = await User.find({
        email: { $regex: search, $options: "i" },
      }).select("_id");

      if (users.length > 0) {
        searchQuery.$or.push({ user: { $in: users.map((u) => u._id) } });
      }

      // Combine with existing query
      const finalQuery = { ...query, ...searchQuery };

      [transactions, total] = await Promise.all([
        Payment.find(finalQuery)
          .populate("user", "email firstName lastName")
          .populate("subscription", "planName planType")
          .populate("event", "name eventType")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Payment.countDocuments(finalQuery),
      ]);
    } else {
      [transactions, total] = await Promise.all([
        Payment.find(query)
          .populate("user", "email firstName lastName")
          .populate("subscription", "planName planType")
          .populate("event", "name eventType")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Payment.countDocuments(query),
      ]);
    }

    return {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get transaction by ID with full details
   * @param {String} transactionId - Transaction ID
   * @returns {Object} Transaction details
   */
  async getTransactionById(transactionId) {
    const transaction = await Payment.findById(transactionId)
      .populate("user", "email firstName lastName phone")
      .populate("subscription", "planName planType status")
      .populate("event", "name eventType startDate")
      .lean();

    if (!transaction) {
      throw createError(404, "Transaction not found");
    }

    // Get related transactions (same user, same subscription/event)
    const relatedQuery = {
      _id: { $ne: transactionId },
      user: transaction.user._id,
    };

    if (transaction.subscription) {
      relatedQuery.subscription = transaction.subscription._id;
    } else if (transaction.event) {
      relatedQuery.event = transaction.event._id;
    }

    const relatedTransactions = await Payment.find(relatedQuery)
      .sort("-createdAt")
      .limit(10)
      .lean();

    // Get audit logs for this transaction
    const auditLogs = await AuditLog.find({
      resource: "payment",
      resourceId: transactionId,
    })
      .populate("admin", "email firstName lastName")
      .sort("-timestamp")
      .lean();

    return {
      ...transaction,
      relatedTransactions,
      auditLogs,
    };
  }

  /**
   * Refund transaction
   * @param {String} transactionId - Transaction ID
   * @param {Number} amount - Refund amount
   * @param {String} reason - Refund reason
   * @param {String} adminId - Admin ID
   * @returns {Object} Updated transaction
   */
  async refundTransaction(transactionId, amount, reason, adminId) {
    const transaction = await Payment.findById(transactionId);

    if (!transaction) {
      throw createError(404, "Transaction not found");
    }

    if (transaction.status !== "completed") {
      throw createError(400, "Can only refund completed transactions");
    }

    if (transaction.status === "refunded") {
      throw createError(400, "Transaction has already been refunded");
    }

    if (amount > transaction.amount) {
      throw createError(400, "Refund amount cannot exceed transaction amount");
    }

    const previousStatus = transaction.status;

    // Update transaction
    transaction.status = "refunded";
    transaction.refundDetails = {
      refundAmount: amount,
      refundReason: reason,
      refundedAt: new Date(),
    };

    await transaction.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "refund_transaction",
      resource: "payment",
      resourceId: transactionId,
      changes: {
        status: { from: previousStatus, to: "refunded" },
        refundAmount: amount,
        reason,
      },
      timestamp: new Date(),
    });

    // TODO: Process actual refund through payment gateway
    // await this.processGatewayRefund(transaction, amount);

    return transaction;
  }

  /**
   * Mark transaction as disputed
   * @param {String} transactionId - Transaction ID
   * @param {String} disputeReason - Dispute reason
   * @param {String} adminId - Admin ID
   * @returns {Object} Updated transaction
   */
  async markAsDisputed(transactionId, disputeReason, adminId) {
    const transaction = await Payment.findById(transactionId);

    if (!transaction) {
      throw createError(404, "Transaction not found");
    }

    // Add dispute metadata
    if (!transaction.metadata) {
      transaction.metadata = new Map();
    }

    transaction.metadata.set("disputed", "true");
    transaction.metadata.set("disputeReason", disputeReason);
    transaction.metadata.set("disputedAt", new Date().toISOString());
    transaction.metadata.set("disputedBy", adminId.toString());

    await transaction.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "mark_transaction_disputed",
      resource: "payment",
      resourceId: transactionId,
      changes: {
        disputed: true,
        reason: disputeReason,
      },
      timestamp: new Date(),
    });

    return transaction;
  }

  /**
   * Resolve dispute
   * @param {String} transactionId - Transaction ID
   * @param {String} resolution - Resolution details
   * @param {String} adminId - Admin ID
   * @returns {Object} Updated transaction
   */
  async resolveDispute(transactionId, resolution, adminId) {
    const transaction = await Payment.findById(transactionId);

    if (!transaction) {
      throw createError(404, "Transaction not found");
    }

    if (!transaction.metadata || !transaction.metadata.get("disputed")) {
      throw createError(400, "Transaction is not marked as disputed");
    }

    // Update dispute metadata
    transaction.metadata.set("disputed", "false");
    transaction.metadata.set("disputeResolution", resolution);
    transaction.metadata.set("disputeResolvedAt", new Date().toISOString());
    transaction.metadata.set("disputeResolvedBy", adminId.toString());

    await transaction.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "resolve_transaction_dispute",
      resource: "payment",
      resourceId: transactionId,
      changes: {
        disputed: false,
        resolution,
      },
      timestamp: new Date(),
    });

    return transaction;
  }

  /**
   * Get payment analytics
   * @param {Object} options - Analytics options
   * @returns {Object} Payment analytics
   */
  async getPaymentAnalytics(options = {}) {
    const { startDate, endDate } = options;

    const matchStage = {};

    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const [
      totalTransactions,
      transactionsByStatus,
      transactionsByType,
      transactionsByMethod,
      successRate,
      averageAmount,
      totalRevenue,
      revenueByType,
      revenueByMethod,
      topUsers,
    ] = await Promise.all([
      Payment.countDocuments(matchStage),
      Payment.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: matchStage },
        { $group: { _id: "$paymentType", count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: matchStage },
        { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
      ]),
      this.calculateSuccessRate(matchStage),
      Payment.aggregate([
        { $match: { ...matchStage, status: "completed" } },
        { $group: { _id: null, avg: { $avg: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { ...matchStage, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { ...matchStage, status: "completed" } },
        {
          $group: {
            _id: "$paymentType",
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { ...matchStage, status: "completed" } },
        {
          $group: {
            _id: "$paymentMethod",
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { ...matchStage, status: "completed" } },
        {
          $group: {
            _id: "$user",
            totalSpent: { $sum: "$amount" },
            transactionCount: { $sum: 1 },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        { $unwind: "$userDetails" },
      ]),
    ]);

    return {
      total: totalTransactions,
      byStatus: transactionsByStatus,
      byType: transactionsByType,
      byMethod: transactionsByMethod,
      successRate,
      averageAmount: averageAmount[0]?.avg || 0,
      totalRevenue: totalRevenue[0]?.total || 0,
      revenueByType,
      revenueByMethod,
      topUsers,
    };
  }

  /**
   * Calculate success rate
   * @param {Object} matchStage - Match stage for aggregation
   * @returns {Number} Success rate percentage
   */
  async calculateSuccessRate(matchStage) {
    const results = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
    ]);

    if (results.length === 0 || results[0].total === 0) {
      return 0;
    }

    return (
      Math.round((results[0].successful / results[0].total) * 100 * 100) / 100
    );
  }

  /**
   * Export transactions
   * @param {Object} filters - Export filters
   * @returns {Array} Transactions data
   */
  async exportTransactions(filters = {}) {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.paymentType) query.paymentType = filters.paymentType;
    if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const transactions = await Payment.find(query)
      .populate("user", "email firstName lastName")
      .populate("subscription", "planName planType")
      .populate("event", "name eventType")
      .sort("-createdAt")
      .lean();

    return transactions.map((txn) => ({
      id: txn._id,
      transactionId: txn.transactionId,
      reference: txn.reference,
      userEmail: txn.user?.email,
      userName: `${txn.user?.firstName} ${txn.user?.lastName}`,
      paymentType: txn.paymentType,
      paymentMethod: txn.paymentMethod,
      amount: txn.amount,
      currency: txn.currency,
      status: txn.status,
      subscriptionPlan: txn.subscription?.planName,
      eventName: txn.event?.name,
      createdAt: txn.createdAt,
      refundAmount: txn.refundDetails?.refundAmount,
      refundReason: txn.refundDetails?.refundReason,
    }));
  }

  /**
   * Reconcile payments with gateway
   * @param {String} paymentMethod - Payment method (flutterwave/paystack)
   * @param {Object} options - Reconciliation options
   * @returns {Object} Reconciliation report
   */
  async reconcilePayments(paymentMethod, options = {}) {
    const { startDate, endDate } = options;

    const query = {
      paymentMethod,
      status: "completed",
    };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const platformTransactions = await Payment.find(query).lean();

    // TODO: Fetch transactions from payment gateway
    // const gatewayTransactions = await this.fetchGatewayTransactions(paymentMethod, startDate, endDate);

    // For now, return platform data
    const report = {
      paymentMethod,
      period: { startDate, endDate },
      platform: {
        count: platformTransactions.length,
        totalAmount: platformTransactions.reduce(
          (sum, txn) => sum + txn.amount,
          0
        ),
      },
      gateway: {
        count: 0, // TODO: From gateway
        totalAmount: 0, // TODO: From gateway
      },
      discrepancies: [], // TODO: Compare and find discrepancies
    };

    return report;
  }

  /**
   * Get transaction trends
   * @param {Object} options - Trend options
   * @returns {Array} Transaction trends
   */
  async getTransactionTrends(options = {}) {
    const { startDate, endDate, groupBy = "day" } = options;

    const matchStage = {};

    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const groupByField =
      groupBy === "hour"
        ? {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
            hour: { $hour: "$createdAt" },
          }
        : groupBy === "day"
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

    const trends = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupByField,
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0],
            },
          },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
          "_id.hour": 1,
        },
      },
    ]);

    return trends;
  }

  /**
   * Get disputed transactions
   * @param {Object} options - Query options
   * @returns {Object} Disputed transactions
   */
  async getDisputedTransactions(options = {}) {
    const { page = 1, limit = 20 } = options;

    const query = {
      "metadata.disputed": "true",
    };

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Payment.find(query)
        .populate("user", "email firstName lastName")
        .populate("subscription", "planName planType")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(query),
    ]);

    return {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export default new AdminTransactionManagementService();
