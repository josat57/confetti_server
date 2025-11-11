import express from "express";
import AIEventPlannerController from "../controllers/ai-planner.controller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { protect as authenticate } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/v1/ai-planner/analyze
 * @desc    Analyze event and generate AI-powered plan
 * @access  Public (rate limited)
 */
router.post(
  "/analyze",
  rateLimiter("ai-planner", 5, 60 * 60), // 5 requests per hour
  AIEventPlannerController.analyzeEvent
);

/**
 * @route   GET /api/v1/ai-planner/result/:sessionToken
 * @desc    Get event plan by session token
 * @access  Public
 */
router.get("/result/:sessionToken", AIEventPlannerController.getEventPlan);

/**
 * @route   POST /api/v1/ai-planner/save
 * @desc    Save event plan to user account
 * @access  Private
 */
router.post("/save", authenticate, AIEventPlannerController.saveEventPlan);

/**
 * @route   GET /api/v1/ai-planner/full/:eventId
 * @desc    Get full event plan with vendor details
 * @access  Private
 */
router.get(
  "/full/:eventId",
  authenticate,
  AIEventPlannerController.getFullEventPlan
);

/**
 * @route   GET /api/v1/ai-planner/health
 * @desc    Health check for AI services
 * @access  Public
 */
router.get("/health", AIEventPlannerController.healthCheck);

export default router;
