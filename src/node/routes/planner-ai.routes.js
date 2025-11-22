import express from "express";
import PlannerAIController from "../controllers/planner-ai.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication and planner role
router.use(protect);
router.use(restrictTo("event-planner"));

/**
 * @route   POST /api/v1/planner/ai/generate-plan
 * @desc    Generate comprehensive event plan using AI
 * @access  Private (Event Planners only)
 */
router.post("/generate-plan", PlannerAIController.generatePlan);

/**
 * @route   POST /api/v1/planner/ai/suggest-vendors
 * @desc    Get AI-powered vendor recommendations
 * @access  Private (Event Planners only)
 */
router.post("/suggest-vendors", PlannerAIController.suggestVendors);

/**
 * @route   POST /api/v1/planner/ai/optimize-budget
 * @desc    Optimize budget allocation using AI
 * @access  Private (Event Planners only)
 */
router.post("/optimize-budget", PlannerAIController.optimizeBudget);

/**
 * @route   POST /api/v1/planner/ai/save-plan
 * @desc    Save AI-generated plan as event
 * @access  Private (Event Planners only)
 */
router.post("/save-plan", PlannerAIController.savePlan);

/**
 * @route   GET /api/v1/planner/ai/usage
 * @desc    Get AI usage statistics for current planner
 * @access  Private (Event Planners only)
 */
router.get("/usage", PlannerAIController.getUsageStats);

export default router;
