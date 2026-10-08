/**
 * Branding Routes
 *
 * Routes for managing business branding and theme customization.
 * All routes require authentication.
 */

import express from "express";
import {
  getBranding,
  getTheme,
  getCSSVariables,
  updateBranding,
  resetBranding,
} from "../controllers/branding.controller.js";
import { protect } from "../middleware/auth.js";
import { assertFeature } from "../services/plan-access.service.js";

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Get branding configuration
router.get("/", getBranding);

// Get theme object (formatted for frontend)
router.get("/theme", getTheme);

// Get CSS variables
router.get("/css", getCSSVariables);

// Planners need a plan with branded exports (Agency) to change branding
const plannerBrandingGate = async (req, res, next) => {
  try {
    if (req.user.role === "event-planner") {
      await assertFeature(req, "brandedExports", { label: "Branded proposals and exports" });
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Update branding
router.put("/", plannerBrandingGate, updateBranding);

// Reset to default branding
router.post("/reset", resetBranding);

export default router;
