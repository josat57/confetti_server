import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, "Expense description is required"],
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, "Expense amount is required"],
    min: [0, "Amount cannot be negative"],
  },
  category: {
    type: String,
    required: [true, "Expense category is required"],
    enum: [
      "venue",
      "catering",
      "decoration",
      "entertainment",
      "photography",
      "videography",
      "transportation",
      "invitations",
      "favors",
      "attire",
      "flowers",
      "cake",
      "rentals",
      "staff",
      "other",
    ],
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "overdue", "cancelled"],
    default: "pending",
  },
  paymentDueDate: Date,
  paymentMethod: String,
  receiptUrl: String,
  receiptFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "uploads.files",
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, {
  timestamps: true,
});

const budgetCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  allocated: {
    type: Number,
    required: true,
    min: 0,
  },
  spent: {
    type: Number,
    default: 0,
    min: 0,
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100,
  },
});

const budgetSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event reference is required"],
      unique: true,
      index: true,
    },
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Planner reference is required"],
      index: true,
    },
    totalBudget: {
      type: Number,
      required: [true, "Total budget is required"],
      min: [0, "Budget cannot be negative"],
    },
    currency: {
      type: String,
      default: "NGN",
      enum: ["NGN", "USD", "EUR", "GBP"],
    },
    categories: [budgetCategorySchema],
    expenses: [expenseSchema],
    contingency: {
      percentage: {
        type: Number,
        default: 10,
        min: 0,
        max: 100,
      },
      amount: {
        type: Number,
        default: 0,
      },
    },
    notes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

budgetSchema.index({ planner: 1, event: 1 });

budgetSchema.virtual("totalSpent").get(function () {
  return this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
});

budgetSchema.virtual("remaining").get(function () {
  return this.totalBudget - this.totalSpent;
});

budgetSchema.virtual("spentPercentage").get(function () {
  if (this.totalBudget === 0) return 0;
  return (this.totalSpent / this.totalBudget) * 100;
});

budgetSchema.virtual("isOverBudget").get(function () {
  return this.totalSpent > this.totalBudget;
});

budgetSchema.methods.updateCategorySpent = function () {
  this.categories.forEach((category) => {
    const categoryExpenses = this.expenses.filter(
      (expense) => expense.category === category.name
    );
    category.spent = categoryExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );
  });
};

budgetSchema.methods.addExpense = function (expenseData) {
  this.expenses.push(expenseData);
  this.updateCategorySpent();
  return this.save();
};

budgetSchema.methods.updateExpense = function (expenseId, updates) {
  const expense = this.expenses.id(expenseId);
  if (!expense) {
    throw new Error("Expense not found");
  }
  Object.assign(expense, updates);
  this.updateCategorySpent();
  return this.save();
};

budgetSchema.methods.deleteExpense = function (expenseId) {
  this.expenses.pull(expenseId);
  this.updateCategorySpent();
  return this.save();
};

budgetSchema.methods.getCategoryAlerts = function () {
  const alerts = [];
  this.categories.forEach((category) => {
    const percentage = (category.spent / category.allocated) * 100;
    if (percentage >= 80 && percentage < 100) {
      alerts.push({
        category: category.name,
        type: "warning",
        message: `${category.name} budget is at ${percentage.toFixed(1)}% (${category.spent}/${category.allocated})`,
        percentage,
      });
    } else if (percentage >= 100) {
      alerts.push({
        category: category.name,
        type: "danger",
        message: `${category.name} budget exceeded! ${percentage.toFixed(1)}% (${category.spent}/${category.allocated})`,
        percentage,
      });
    }
  });
  return alerts;
};

budgetSchema.pre("save", function (next) {
  this.updateCategorySpent();
  this.contingency.amount = (this.totalBudget * this.contingency.percentage) / 100;
  next();
});

const Budget = mongoose.model("Budget", budgetSchema);

export default Budget;
