/**
 * Business Profile Routes
 *
 * Routes for managing business profiles for planners and vendors.
 * All routes require authentication.
 */

import express from "express";
import {
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
  uploadLogo,
  deleteLogo,
  addLocation,
  updateLocation,
  deleteLocation,
} from "../controllers/business-profile.controller.js";
import { protect } from "../middleware/auth.js";
import { uploadLogo as uploadLogoMiddleware } from "../middleware/upload.js";

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Business profile CRUD routes
router.post("/", createProfile);
router.get("/", getProfile);
router.put("/", updateProfile);
router.delete("/", deleteProfile);

// Logo management routes
router.post("/logo", uploadLogoMiddleware, uploadLogo);
router.delete("/logo", deleteLogo);

// Location management routes (planner only)
router.post("/locations", addLocation);
router.put("/locations/:id", updateLocation);
router.delete("/locations/:id", deleteLocation);

export default router;
