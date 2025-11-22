import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getRevenueReport,
  getExpenseReport,
  getProfitLossStatement,
  exportFinancialReport,
  createExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
} from "../controllers/financial.controller.js";

const router = express.Router();

// All financial routes require authentication
router.use(protect);

// Financial Reports
router.get("/reports/revenue", getRevenueReport);
router.get("/reports/expenses", getExpenseReport);
router.get("/reports/profit-loss", getProfitLossStatement);
router.post("/reports/export", exportFinancialReport);

// Expense Management
router.get("/expenses", getExpenses);
router.post("/expenses", createExpense);
router.put("/expenses/:id", updateExpense);
router.delete("/expenses/:id", deleteExpense);

export default router;
