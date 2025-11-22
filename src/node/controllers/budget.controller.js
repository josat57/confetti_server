import Budget from "../models/budget.model.js";
import Event from "../models/event.model.js";
import { applyBudgetTemplate } from "../config/budget-templates.js";

export const createOrUpdateBudget = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { totalBudget, currency, categories, contingency, notes } = req.body;

    const event = await Event.findOne({
      _id: eventId,
      planner: req.user._id,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    let budget = await Budget.findOne({ event: eventId });

    if (budget) {
      if (totalBudget !== undefined) budget.totalBudget = totalBudget;
      if (currency) budget.currency = currency;
      if (categories) budget.categories = categories;
      if (contingency) budget.contingency = contingency;
      if (notes !== undefined) budget.notes = notes;

      await budget.save();

      return res.status(200).json({
        success: true,
        message: "Budget updated successfully",
        data: budget,
      });
    }

    let budgetCategories = categories;
    if (!budgetCategories && event.eventType) {
      budgetCategories = applyBudgetTemplate(event.eventType, totalBudget);
    }

    budget = await Budget.create({
      event: eventId,
      planner: req.user._id,
      totalBudget,
      currency: currency || "NGN",
      categories: budgetCategories || [],
      contingency: contingency || { percentage: 10 },
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Budget created successfully",
      data: budget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating/updating budget",
      error: error.message,
    });
  }
};

export const getBudget = async (req, res) => {
  try {
    const { eventId } = req.params;

    const budget = await Budget.findOne({
      event: eventId,
      planner: req.user._id,
    })
      .populate("event", "title startDate eventType")
      .populate("expenses.vendor", "name businessName")
      .populate("expenses.createdBy", "name email");

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    const alerts = budget.getCategoryAlerts();

    res.status(200).json({
      success: true,
      data: {
        ...budget.toObject(),
        alerts,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching budget",
      error: error.message,
    });
  }
};

export const addExpense = async (req, res) => {
  try {
    const { eventId } = req.params;
    const expenseData = {
      ...req.body,
      createdBy: req.user._id,
    };

    const budget = await Budget.findOne({
      event: eventId,
      planner: req.user._id,
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    await budget.addExpense(expenseData);

    const alerts = budget.getCategoryAlerts();

    res.status(201).json({
      success: true,
      message: "Expense added successfully",
      data: budget,
      alerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding expense",
      error: error.message,
    });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const updates = req.body;

    const budget = await Budget.findOne({
      "expenses._id": expenseId,
      planner: req.user._id,
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    await budget.updateExpense(expenseId, updates);

    const alerts = budget.getCategoryAlerts();

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: budget,
      alerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating expense",
      error: error.message,
    });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const budget = await Budget.findOne({
      "expenses._id": expenseId,
      planner: req.user._id,
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    await budget.deleteExpense(expenseId);

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
      data: budget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting expense",
      error: error.message,
    });
  }
};

export const getBudgetSummary = async (req, res) => {
  try {
    const budgets = await Budget.find({ planner: req.user._id })
      .populate("event", "title startDate status")
      .select("totalBudget currency expenses event");

    const summary = {
      totalBudgets: budgets.length,
      totalAllocated: 0,
      totalSpent: 0,
      byEvent: [],
      byCurrency: {},
    };

    budgets.forEach((budget) => {
      const spent = budget.expenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      summary.totalAllocated += budget.totalBudget;
      summary.totalSpent += spent;

      summary.byEvent.push({
        event: budget.event,
        budget: budget.totalBudget,
        spent,
        remaining: budget.totalBudget - spent,
        currency: budget.currency,
      });

      if (!summary.byCurrency[budget.currency]) {
        summary.byCurrency[budget.currency] = {
          allocated: 0,
          spent: 0,
        };
      }
      summary.byCurrency[budget.currency].allocated += budget.totalBudget;
      summary.byCurrency[budget.currency].spent += spent;
    });

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching budget summary",
      error: error.message,
    });
  }
};

export const getPaymentsDue = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const budgets = await Budget.find({ planner: req.user._id })
      .populate("event", "title startDate")
      .populate("expenses.vendor", "name businessName");

    const paymentsDue = [];
    const now = new Date();

    budgets.forEach((budget) => {
      budget.expenses.forEach((expense) => {
        if (
          expense.paymentStatus === "pending" &&
          expense.paymentDueDate &&
          expense.paymentDueDate <= futureDate
        ) {
          const isOverdue = expense.paymentDueDate < now;
          paymentsDue.push({
            expense: {
              _id: expense._id,
              description: expense.description,
              amount: expense.amount,
              category: expense.category,
              vendor: expense.vendor,
              paymentDueDate: expense.paymentDueDate,
            },
            event: budget.event,
            currency: budget.currency,
            isOverdue,
            daysUntilDue: Math.ceil(
              (expense.paymentDueDate - now) / (1000 * 60 * 60 * 24)
            ),
          });
        }
      });
    });

    paymentsDue.sort((a, b) => a.expense.paymentDueDate - b.expense.paymentDueDate);

    res.status(200).json({
      success: true,
      data: {
        total: paymentsDue.length,
        overdue: paymentsDue.filter((p) => p.isOverdue).length,
        upcoming: paymentsDue.filter((p) => !p.isOverdue).length,
        payments: paymentsDue,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payments due",
      error: error.message,
    });
  }
};
