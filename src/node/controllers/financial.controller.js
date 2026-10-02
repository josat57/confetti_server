import Vendor from "../models/vendor.model.js";
import Booking from "../models/booking.model.js";
import Invoice from "../models/invoice.model.js";
import Expense from "../models/expense.model.js";
import { AppError } from "../utils/AppError.js";
import { renderReport, sendReportFile } from "../utils/report-renderer.js";

/**
 * Money a vendor actually collected, from paid / partially paid invoices
 * (Payment documents are platform payments and have no vendor field).
 * Dated by paidAt, falling back to the invoice's last update.
 */
const getRevenueEntries = async (vendorId, dateFilter = {}) => {
  const query = { vendor: vendorId, status: { $in: ["paid", "partial"] }, amountPaid: { $gt: 0 } };
  if (Object.keys(dateFilter).length > 0) {
    query.$or = [{ paidAt: dateFilter }, { paidAt: { $exists: false }, updatedAt: dateFilter }];
  }
  const invoices = await Invoice.find(query).populate("booking", "eventType eventDate").lean();
  return invoices.map((inv) => ({
    amount: inv.amountPaid,
    date: inv.paidAt || inv.updatedAt,
    currency: inv.currency,
    eventType: inv.booking?.eventType,
    invoiceNumber: inv.invoiceNumber,
  }));
};

const buildDateFilter = (startDate, endDate) => {
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);
  for (const d of Object.values(dateFilter)) {
    if (isNaN(d)) throw new AppError("Invalid startDate or endDate", 400);
  }
  return dateFilter;
};

/** Revenue, expenses and profit for a vendor over an optional date range. */
const computeProfitLoss = async (vendorId, startDate, endDate) => {
  const dateFilter = buildDateFilter(startDate, endDate);
  const revenue = await getRevenueEntries(vendorId, dateFilter);
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);

  const expenseQuery = { vendor: vendorId };
  if (Object.keys(dateFilter).length > 0) expenseQuery.date = dateFilter;
  const expenses = await Expense.find(expenseQuery).lean();
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const expenseBreakdown = {};
  for (const e of expenses) {
    expenseBreakdown[e.category] = (expenseBreakdown[e.category] || 0) + e.amount;
  }
  const netProfit = totalRevenue - totalExpenses;
  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    grossProfit: totalRevenue,
    netProfit,
    profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    expenseBreakdown: Object.entries(expenseBreakdown).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    })),
  };
};

/**
 * Get revenue report
 * GET /api/v1/vendors/reports/revenue
 */
export const getRevenueReport = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { startDate, endDate, groupBy = "month" } = req.query;

    // Collected revenue (paid / partially paid invoices)
    const payments = await getRevenueEntries(vendor._id, buildDateFilter(startDate, endDate));

    // Calculate totals
    const totalRevenue = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );
    const averageBookingValue =
      payments.length > 0 ? totalRevenue / payments.length : 0;

    // Group by time period
    const revenueByPeriod = {};
    payments.forEach((payment) => {
      let period;
      const date = new Date(payment.date);

      if (groupBy === "day") {
        period = date.toISOString().split("T")[0];
      } else if (groupBy === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        period = weekStart.toISOString().split("T")[0];
      } else if (groupBy === "month") {
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
      } else if (groupBy === "year") {
        period = date.getFullYear().toString();
      }

      if (!revenueByPeriod[period]) {
        revenueByPeriod[period] = { revenue: 0, count: 0 };
      }
      revenueByPeriod[period].revenue += payment.amount;
      revenueByPeriod[period].count += 1;
    });

    // Revenue by event type
    const revenueByEventType = {};
    payments.forEach((payment) => {
      if (payment.eventType) {
        const eventType = payment.eventType;
        if (!revenueByEventType[eventType]) {
          revenueByEventType[eventType] = { revenue: 0, count: 0 };
        }
        revenueByEventType[eventType].revenue += payment.amount;
        revenueByEventType[eventType].count += 1;
      }
    });

    res.status(200).json({
      status: "success",
      data: {
        summary: {
          totalRevenue,
          totalBookings: payments.length,
          averageBookingValue,
          period: {
            start: startDate || "all time",
            end: endDate || "present",
          },
        },
        revenueByPeriod: Object.entries(revenueByPeriod).map(
          ([period, data]) => ({
            period,
            revenue: data.revenue,
            bookings: data.count,
          })
        ),
        revenueByEventType: Object.entries(revenueByEventType).map(
          ([type, data]) => ({
            eventType: type,
            revenue: data.revenue,
            bookings: data.count,
          })
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get expense report
 * GET /api/v1/vendors/reports/expenses
 */
export const getExpenseReport = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { startDate, endDate, category, location } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Build query
    const query = { vendor: vendor._id };
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter;
    }
    if (category) query.category = category;
    if (location) query.location = location;

    // Get expenses
    const expenses = await Expense.find(query).populate("location", "name");

    // Calculate totals
    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

    // Group by category
    const expensesByCategory = {};
    expenses.forEach((expense) => {
      const cat = expense.category;
      if (!expensesByCategory[cat]) {
        expensesByCategory[cat] = { amount: 0, count: 0 };
      }
      expensesByCategory[cat].amount += expense.amount;
      expensesByCategory[cat].count += 1;
    });

    // Group by month
    const expensesByMonth = {};
    expenses.forEach((expense) => {
      const date = new Date(expense.date);
      const month = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!expensesByMonth[month]) {
        expensesByMonth[month] = { amount: 0, count: 0 };
      }
      expensesByMonth[month].amount += expense.amount;
      expensesByMonth[month].count += 1;
    });

    res.status(200).json({
      status: "success",
      data: {
        summary: {
          totalExpenses,
          totalTransactions: expenses.length,
          averageExpense:
            expenses.length > 0 ? totalExpenses / expenses.length : 0,
          period: {
            start: startDate || "all time",
            end: endDate || "present",
          },
        },
        expensesByCategory: Object.entries(expensesByCategory).map(
          ([category, data]) => ({
            category,
            amount: data.amount,
            count: data.count,
            percentage: (data.amount / totalExpenses) * 100,
          })
        ),
        expensesByMonth: Object.entries(expensesByMonth).map(
          ([month, data]) => ({
            month,
            amount: data.amount,
            count: data.count,
          })
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get profit and loss statement
 * GET /api/v1/vendors/reports/profit-loss
 */
export const getProfitLossStatement = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { startDate, endDate, compareWith } = req.query;

    const pl = await computeProfitLoss(vendor._id, startDate, endDate);
    const { totalRevenue, totalExpenses, grossProfit, netProfit, profitMargin } = pl;

    // Comparison with the preceding period of equal length
    let comparison = null;
    if (compareWith && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const prev = await computeProfitLoss(vendor._id, new Date(start - (end - start)), start);
      const pct = (cur, before, abs = false) =>
        before !== 0 ? ((cur - before) / (abs ? Math.abs(before) : before)) * 100 : 0;
      comparison = {
        revenue: { current: totalRevenue, previous: prev.totalRevenue, change: pct(totalRevenue, prev.totalRevenue) },
        expenses: { current: totalExpenses, previous: prev.totalExpenses, change: pct(totalExpenses, prev.totalExpenses) },
        profit: { current: netProfit, previous: prev.netProfit, change: pct(netProfit, prev.netProfit, true) },
      };
    }

    res.status(200).json({
      status: "success",
      data: {
        period: {
          start: startDate || "all time",
          end: endDate || "present",
        },
        revenue: {
          total: totalRevenue,
          transactions: pl.revenue.length,
        },
        expenses: {
          total: totalExpenses,
          transactions: pl.expenses.length,
          breakdown: pl.expenseBreakdown,
        },
        profit: {
          gross: grossProfit,
          net: netProfit,
          margin: profitMargin,
        },
        comparison,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export financial report as PDF
 * POST /api/v1/vendors/reports/export
 */
export const exportFinancialReport = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { reportType, startDate, endDate } = req.body;
    const REPORT_TYPES = ["revenue", "expenses", "profit-loss"];

    if (!reportType) {
      return next(new AppError("Report type is required", 400));
    }
    if (!REPORT_TYPES.includes(reportType)) {
      return next(new AppError(`reportType must be one of: ${REPORT_TYPES.join(", ")}`, 400));
    }

    // Compute everything before sending headers so errors still return JSON
    const pl = await computeProfitLoss(vendor._id, startDate, endDate);
    const round2 = (n) => Math.round(n * 100) / 100;
    let data;
    if (reportType === "revenue") {
      data = {
        totalRevenue: round2(pl.totalRevenue),
        totalTransactions: pl.revenue.length,
        averageTransaction: round2(pl.revenue.length ? pl.totalRevenue / pl.revenue.length : 0),
        payments: pl.revenue.map((r) => ({
          date: r.date,
          invoice: r.invoiceNumber || "",
          eventType: r.eventType || "",
          amount: r.amount,
          currency: r.currency || "",
        })),
      };
    } else if (reportType === "expenses") {
      data = {
        totalExpenses: round2(pl.totalExpenses),
        totalTransactions: pl.expenses.length,
        byCategory: pl.expenseBreakdown.map((b) => ({ ...b, percentage: round2(b.percentage) })),
        expenses: pl.expenses.map((e) => ({
          date: e.date,
          category: e.category,
          description: e.description || "",
          amount: e.amount,
        })),
      };
    } else {
      data = {
        revenue: round2(pl.totalRevenue),
        expenses: round2(pl.totalExpenses),
        grossProfit: round2(pl.grossProfit),
        netProfit: round2(pl.netProfit),
        profitMarginPercent: round2(pl.profitMargin),
        expenseBreakdown: pl.expenseBreakdown.map((b) => ({ ...b, percentage: round2(b.percentage) })),
      };
    }

    const titles = { revenue: "Revenue Report", expenses: "Expense Report", "profit-loss": "Profit & Loss Statement" };
    const file = await renderReport({
      title: `${vendor.businessName} - ${titles[reportType]}`,
      format: "pdf",
      data,
      meta: {
        Period: `${startDate || "All time"} to ${endDate || "Present"}`,
        Generated: new Date(),
      },
    });
    sendReportFile(res, file, `${reportType}-report-${Date.now()}`);
  } catch (error) {
    next(error);
  }
};

/**
 * Create expense
 * POST /api/v1/vendors/expenses
 */
export const createExpense = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const expense = await Expense.create({
      ...req.body,
      vendor: vendor._id,
      createdBy: req.user._id,
    });

    res.status(201).json({
      status: "success",
      message: "Expense created successfully",
      data: { expense },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all expenses
 * GET /api/v1/vendors/expenses
 */
export const getExpenses = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { page = 1, limit = 20, category, startDate, endDate } = req.query;

    const query = { vendor: vendor._id };
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const expenses = await Expense.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate("location", "name")
      .populate("createdBy", "userName email");

    const total = await Expense.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: expenses.length,
      data: {
        expenses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update expense
 * PUT /api/v1/vendors/expenses/:id
 */
export const updateExpense = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, vendor: vendor._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!expense) return next(new AppError("Expense not found", 404));

    res.status(200).json({
      status: "success",
      message: "Expense updated successfully",
      data: { expense },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete expense
 * DELETE /api/v1/vendors/expenses/:id
 */
export const deleteExpense = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!expense) return next(new AppError("Expense not found", 404));

    res.status(200).json({
      status: "success",
      message: "Expense deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
