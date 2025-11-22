import Vendor from "../models/vendor.model.js";
import Booking from "../models/booking.model.js";
import Payment from "../models/payment.model.js";
import Invoice from "../models/invoice.model.js";
import Expense from "../models/expense.model.js";
import { AppError } from "../utils/AppError.js";
import PDFDocument from "pdfkit";

/**
 * Get revenue report
 * GET /api/v1/vendors/reports/revenue
 */
export const getRevenueReport = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { startDate, endDate, groupBy = "month", location } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Build query
    const query = { vendor: vendor._id };
    if (Object.keys(dateFilter).length > 0) {
      query.createdAt = dateFilter;
    }
    if (location) query.location = location;

    // Get payments
    const payments = await Payment.find({
      ...query,
      status: "completed",
    }).populate("booking", "eventDate eventType");

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
      const date = new Date(payment.createdAt);

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
      if (payment.booking && payment.booking.eventType) {
        const eventType = payment.booking.eventType;
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

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Get revenue (completed payments)
    const revenueQuery = { vendor: vendor._id, status: "completed" };
    if (Object.keys(dateFilter).length > 0) {
      revenueQuery.createdAt = dateFilter;
    }
    const payments = await Payment.find(revenueQuery);
    const totalRevenue = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    // Get expenses
    const expenseQuery = { vendor: vendor._id };
    if (Object.keys(dateFilter).length > 0) {
      expenseQuery.date = dateFilter;
    }
    const expenses = await Expense.find(expenseQuery);
    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

    // Calculate profit
    const grossProfit = totalRevenue;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Expense breakdown
    const expenseBreakdown = {};
    expenses.forEach((expense) => {
      const category = expense.category;
      if (!expenseBreakdown[category]) {
        expenseBreakdown[category] = 0;
      }
      expenseBreakdown[category] += expense.amount;
    });

    // Comparison with previous period if requested
    let comparison = null;
    if (compareWith) {
      const prevDateFilter = {};
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const duration = end - start;
        prevDateFilter.$gte = new Date(start - duration);
        prevDateFilter.$lte = start;

        // Previous period revenue
        const prevRevenue = await Payment.find({
          vendor: vendor._id,
          status: "completed",
          createdAt: prevDateFilter,
        });
        const prevTotalRevenue = prevRevenue.reduce(
          (sum, p) => sum + p.amount,
          0
        );

        // Previous period expenses
        const prevExpenses = await Expense.find({
          vendor: vendor._id,
          date: prevDateFilter,
        });
        const prevTotalExpenses = prevExpenses.reduce(
          (sum, e) => sum + e.amount,
          0
        );
        const prevNetProfit = prevTotalRevenue - prevTotalExpenses;

        comparison = {
          revenue: {
            current: totalRevenue,
            previous: prevTotalRevenue,
            change:
              prevTotalRevenue > 0
                ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
                : 0,
          },
          expenses: {
            current: totalExpenses,
            previous: prevTotalExpenses,
            change:
              prevTotalExpenses > 0
                ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) *
                  100
                : 0,
          },
          profit: {
            current: netProfit,
            previous: prevNetProfit,
            change:
              prevNetProfit !== 0
                ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100
                : 0,
          },
        };
      }
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
          transactions: payments.length,
        },
        expenses: {
          total: totalExpenses,
          transactions: expenses.length,
          breakdown: Object.entries(expenseBreakdown).map(
            ([category, amount]) => ({
              category,
              amount,
              percentage: (amount / totalExpenses) * 100,
            })
          ),
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

    if (!reportType) {
      return next(new AppError("Report type is required", 400));
    }

    // Create PDF document
    const doc = new PDFDocument();
    const filename = `${reportType}-report-${Date.now()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    doc.pipe(res);

    // Add header
    doc.fontSize(20).text(`${vendor.businessName}`, { align: "center" });
    doc
      .fontSize(16)
      .text(`${reportType.toUpperCase()} REPORT`, { align: "center" });
    doc.moveDown();
    doc
      .fontSize(12)
      .text(`Period: ${startDate || "All time"} to ${endDate || "Present"}`, {
        align: "center",
      });
    doc.moveDown(2);

    // Get report data based on type
    if (reportType === "revenue") {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      const query = { vendor: vendor._id, status: "completed" };
      if (Object.keys(dateFilter).length > 0) {
        query.createdAt = dateFilter;
      }

      const payments = await Payment.find(query);
      const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

      doc.fontSize(14).text("Revenue Summary", { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Total Revenue: ₦${totalRevenue.toLocaleString()}`);
      doc.text(`Total Transactions: ${payments.length}`);
      doc.text(
        `Average Transaction: ₦${(
          totalRevenue / payments.length || 0
        ).toLocaleString()}`
      );
    } else if (reportType === "profit-loss") {
      // Add P&L data
      doc.fontSize(14).text("Profit & Loss Statement", { underline: true });
      doc.moveDown();
      doc.text("This is a placeholder for P&L data");
    }

    doc.end();
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
