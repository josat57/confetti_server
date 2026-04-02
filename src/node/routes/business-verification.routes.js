/**
 * Business Verification Routes (Admin)
 *
 * Admin routes for managing business profile verification.
 * All routes require admin authentication and authorization.
 */

import express from "express";
import {
  listProfiles,
  listPending,
  getProfileDetails,
  verifyProfile,
  rejectProfile,
  getStats,
} from "../controllers/business-verification.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(protect);
router.use(restrictTo("admin"));

// Verification statistics
router.get("/stats", getStats);

// List pending profiles (most common operation)
router.get("/pending", listPending);

// List all profiles with filtering
router.get("/", listProfiles);

// Profile details
router.get("/:id", getProfileDetails);

// Verify profile
router.put("/:id/verify", verifyProfile);

// Reject profile
router.put("/:id/reject", rejectProfile);

export default router;
