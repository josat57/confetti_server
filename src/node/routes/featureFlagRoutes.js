import express from "express";
import * as featureFlagController from "../controllers/featureFlagController.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(restrictTo("admin"));

// ==================== FEATURE FLAGS ====================

// Get all feature flags
router.get("/feature-flags", featureFlagController.getFeatureFlags);

// Get feature flag by ID
router.get("/feature-flags/:id", featureFlagController.getFeatureFlagById);

// Create feature flag
router.post("/feature-flags", featureFlagController.createFeatureFlag);

// Update feature flag
router.put("/feature-flags/:id", featureFlagController.updateFeatureFlag);

// Delete feature flag
router.delete("/feature-flags/:id", featureFlagController.deleteFeatureFlag);

// Toggle feature flag
router.post(
  "/feature-flags/:id/toggle",
  featureFlagController.toggleFeatureFlag
);

// Check if feature is enabled
router.post("/feature-flags/check", featureFlagController.checkFeatureFlag);

// Get feature flag usage statistics
router.get(
  "/feature-flags/:id/usage",
  featureFlagController.getFeatureFlagUsage
);

// ==================== A/B TESTS ====================

// Get all A/B tests
router.get("/ab-tests", featureFlagController.getABTests);

// Get A/B test by ID
router.get("/ab-tests/:id", featureFlagController.getABTestById);

// Create A/B test
router.post("/ab-tests", featureFlagController.createABTest);

// Update A/B test
router.put("/ab-tests/:id", featureFlagController.updateABTest);

// Delete A/B test
router.delete("/ab-tests/:id", featureFlagController.deleteABTest);

// Start A/B test
router.post("/ab-tests/:id/start", featureFlagController.startABTest);

// Pause A/B test
router.post("/ab-tests/:id/pause", featureFlagController.pauseABTest);

// Complete A/B test
router.post("/ab-tests/:id/complete", featureFlagController.completeABTest);

// Get A/B test results
router.get("/ab-tests/:id/results", featureFlagController.getABTestResults);

// Get A/B test analytics
router.get("/ab-tests/:id/analytics", featureFlagController.getABTestAnalytics);

// Track conversion
router.post(
  "/ab-tests/:testKey/conversion",
  featureFlagController.trackConversion
);

// Track event
router.post("/ab-tests/:testKey/event", featureFlagController.trackEvent);

export default router;
