import express from "express";
import { requireEventPass } from "../services/plan-access.service.js";
import {
  createOrUpdateBudget,
  getBudget,
  addExpense,
  updateExpense,
  deleteExpense,
  getBudgetSummary,
  getPaymentsDue,
} from "../controllers/budget.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/overview", getBudgetSummary);
router.get("/summary", getBudgetSummary);
router.get("/payments-due", getPaymentsDue);

export default router;

export const eventBudgetRoutes = express.Router({ mergeParams: true });
eventBudgetRoutes.use(protect);

eventBudgetRoutes.put("/", createOrUpdateBudget);
eventBudgetRoutes.get("/", getBudget);
// Tracking expenses is a pass feature for clients (the budget overview is free)
const budgetTracking = requireEventPass("budgetTracking", { label: "Budget tracking" });
eventBudgetRoutes.post("/expenses", budgetTracking, addExpense);
eventBudgetRoutes.put("/expenses/:expenseId", budgetTracking, updateExpense);
eventBudgetRoutes.delete("/expenses/:expenseId", budgetTracking, deleteExpense);
