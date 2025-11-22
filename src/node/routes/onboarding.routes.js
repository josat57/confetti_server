import express from "express";
import {
  getOnboardingStatus,
  updateTourStep,
  skipTour,
  resetTour,
  updateTutorialStep,
  loadSampleData,
  markKeyboardShortcutsViewed,
} from "../controllers/onboarding.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Onboarding status
router.get("/status", getOnboardingStatus);

// Tour management
router.post("/tour/step", updateTourStep);
router.post("/tour/skip", skipTour);
router.post("/tour/reset", resetTour);

// Tutorial management
router.post("/tutorial/step", updateTutorialStep);

// Sample data
router.post("/sample-data", restrictTo("event-planner"), loadSampleData);

// Keyboard shortcuts
router.post("/keyboard-shortcuts/viewed", markKeyboardShortcutsViewed);

export default router;
