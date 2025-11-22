import express from "express";
import {
  getAllPlans,
  getPlan,
  getPlanByTypeAndName,
  createPlan,
  updatePlan,
  updatePlanPricing,
  deletePlan,
  bulkUpdatePricing,
} from "../controllers/subscriptionPlan.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

/**
 * Public routes - anyone can view plans
 */
// Get all plans (with optional filters)
router.get("/", getAllPlans);

// Get plan by type and name
router.get("/find/:planType/:planName", getPlanByTypeAndName);

// Get single plan by ID
router.get("/:id", getPlan);

/**
 * Protected routes - Admin only
 */
router.use(protect);
router.use(restrictTo("admin"));

// Create new plan
router.post("/", createPlan);

// Bulk update pricing
router.post("/bulk-update-pricing", bulkUpdatePricing);

// Update plan
router.patch("/:id", updatePlan);

// Update plan pricing
router.patch("/:id/pricing", updatePlanPricing);

// Delete (deactivate) plan
router.delete("/:id", deletePlan);

export default router;
