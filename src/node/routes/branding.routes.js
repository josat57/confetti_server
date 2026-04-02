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

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Get branding configuration
router.get("/", getBranding);

// Get theme object (formatted for frontend)
router.get("/theme", getTheme);

// Get CSS variables
router.get("/css", getCSSVariables);

// Update branding
router.put("/", updateBranding);

// Reset to default branding
router.post("/reset", resetBranding);

export default router;
