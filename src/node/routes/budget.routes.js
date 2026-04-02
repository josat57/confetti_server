import express from "express";
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
eventBudgetRoutes.post("/expenses", addExpense);
eventBudgetRoutes.put("/expenses/:expenseId", updateExpense);
eventBudgetRoutes.delete("/expenses/:expenseId", deleteExpense);
