import featureFlagService from "../services/featureFlagService.js";

// ==================== FEATURE FLAGS ====================

/**
 * Get all feature flags
 * GET /api/v1/admin/feature-flags
 */
export const getFeatureFlags = async (req, res) => {
  try {
    const result = await featureFlagService.getFeatureFlags(req.query);

    res.json({
      success: true,
      data: result.flags,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get feature flags error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch feature flags",
      error: error.message,
    });
  }
};

/**
 * Get feature flag by ID
 * GET /api/v1/admin/feature-flags/:id
 */
export const getFeatureFlagById = async (req, res) => {
  try {
    const flag = await featureFlagService.getFeatureFlagById(req.params.id);

    res.json({
      success: true,
      data: flag,
    });
  } catch (error) {
    console.error("Get feature flag error:", error);
    res.status(error.message === "Feature flag not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create feature flag
 * POST /api/v1/admin/feature-flags
 */
export const createFeatureFlag = async (req, res) => {
  try {
    const flag = await featureFlagService.createFeatureFlag(
      req.body,
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: "Feature flag created successfully",
      data: flag,
    });
  } catch (error) {
    console.error("Create feature flag error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update feature flag
 * PUT /api/v1/admin/feature-flags/:id
 */
export const updateFeatureFlag = async (req, res) => {
  try {
    const flag = await featureFlagService.updateFeatureFlag(
      req.params.id,
      req.body,
      req.user._id
    );

    res.json({
      success: true,
      message: "Feature flag updated successfully",
      data: flag,
    });
  } catch (error) {
    console.error("Update feature flag error:", error);
    res.status(error.message === "Feature flag not found" ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete feature flag
 * DELETE /api/v1/admin/feature-flags/:id
 */
export const deleteFeatureFlag = async (req, res) => {
  try {
    const result = await featureFlagService.deleteFeatureFlag(req.params.id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete feature flag error:", error);
    res.status(error.message === "Feature flag not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Toggle feature flag
 * POST /api/v1/admin/feature-flags/:id/toggle
 */
export const toggleFeatureFlag = async (req, res) => {
  try {
    const flag = await featureFlagService.toggleFeatureFlag(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      message: `Feature flag ${
        flag.enabled ? "enabled" : "disabled"
      } successfully`,
      data: flag,
    });
  } catch (error) {
    console.error("Toggle feature flag error:", error);
    res.status(error.message === "Feature flag not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Check if feature is enabled for user
 * POST /api/v1/admin/feature-flags/check
 */
export const checkFeatureFlag = async (req, res) => {
  try {
    const { featureKey, userId, userType, subscriptionTier } = req.body;

    const enabled = await featureFlagService.isFeatureEnabled(
      featureKey,
      userId,
      userType,
      subscriptionTier
    );

    res.json({
      success: true,
      data: {
        featureKey,
        enabled,
      },
    });
  } catch (error) {
    console.error("Check feature flag error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get feature flag usage statistics
 * GET /api/v1/admin/feature-flags/:id/usage
 */
export const getFeatureFlagUsage = async (req, res) => {
  try {
    const flag = await featureFlagService.getFeatureFlagById(req.params.id);
    const days = parseInt(req.query.days) || 30;
    const stats = await featureFlagService.getFeatureFlagUsageStats(
      flag.key,
      days
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get feature flag usage error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== A/B TESTS ====================

/**
 * Get all A/B tests
 * GET /api/v1/admin/ab-tests
 */
export const getABTests = async (req, res) => {
  try {
    const result = await featureFlagService.getABTests(req.query);

    res.json({
      success: true,
      data: result.tests,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get A/B tests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch A/B tests",
      error: error.message,
    });
  }
};

/**
 * Get A/B test by ID
 * GET /api/v1/admin/ab-tests/:id
 */
export const getABTestById = async (req, res) => {
  try {
    const test = await featureFlagService.getABTestById(req.params.id);

    res.json({
      success: true,
      data: test,
    });
  } catch (error) {
    console.error("Get A/B test error:", error);
    res.status(error.message === "A/B test not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create A/B test
 * POST /api/v1/admin/ab-tests
 */
export const createABTest = async (req, res) => {
  try {
    const test = await featureFlagService.createABTest(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "A/B test created successfully",
      data: test,
    });
  } catch (error) {
    console.error("Create A/B test error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update A/B test
 * PUT /api/v1/admin/ab-tests/:id
 */
export const updateABTest = async (req, res) => {
  try {
    const test = await featureFlagService.updateABTest(
      req.params.id,
      req.body,
      req.user._id
    );

    res.json({
      success: true,
      message: "A/B test updated successfully",
      data: test,
    });
  } catch (error) {
    console.error("Update A/B test error:", error);
    res.status(error.message === "A/B test not found" ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete A/B test
 * DELETE /api/v1/admin/ab-tests/:id
 */
export const deleteABTest = async (req, res) => {
  try {
    const result = await featureFlagService.deleteABTest(req.params.id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete A/B test error:", error);
    res.status(error.message === "A/B test not found" ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Start A/B test
 * POST /api/v1/admin/ab-tests/:id/start
 */
export const startABTest = async (req, res) => {
  try {
    const test = await featureFlagService.startABTest(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      message: "A/B test started successfully",
      data: test,
    });
  } catch (error) {
    console.error("Start A/B test error:", error);
    res.status(error.message === "A/B test not found" ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Pause A/B test
 * POST /api/v1/admin/ab-tests/:id/pause
 */
export const pauseABTest = async (req, res) => {
  try {
    const test = await featureFlagService.pauseABTest(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      message: "A/B test paused successfully",
      data: test,
    });
  } catch (error) {
    console.error("Pause A/B test error:", error);
    res.status(error.message === "A/B test not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Complete A/B test
 * POST /api/v1/admin/ab-tests/:id/complete
 */
export const completeABTest = async (req, res) => {
  try {
    const test = await featureFlagService.completeABTest(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      message: "A/B test completed successfully",
      data: test,
    });
  } catch (error) {
    console.error("Complete A/B test error:", error);
    res.status(error.message === "A/B test not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get A/B test results
 * GET /api/v1/admin/ab-tests/:id/results
 */
export const getABTestResults = async (req, res) => {
  try {
    const test = await featureFlagService.getABTestById(req.params.id);

    res.json({
      success: true,
      data: test.detailedResults,
    });
  } catch (error) {
    console.error("Get A/B test results error:", error);
    res.status(error.message === "A/B test not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get A/B test analytics
 * GET /api/v1/admin/ab-tests/:id/analytics
 */
export const getABTestAnalytics = async (req, res) => {
  try {
    const test = await featureFlagService.getABTestById(req.params.id);
    const analytics = await featureFlagService.getABTestAnalytics(test.key);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Get A/B test analytics error:", error);
    res.status(error.message === "A/B test not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Track A/B test conversion
 * POST /api/v1/admin/ab-tests/:testKey/conversion
 */
export const trackConversion = async (req, res) => {
  try {
    const { userId, eventData } = req.body;

    await featureFlagService.trackConversion(
      req.params.testKey,
      userId,
      eventData
    );

    res.json({
      success: true,
      message: "Conversion tracked successfully",
    });
  } catch (error) {
    console.error("Track conversion error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Track A/B test event
 * POST /api/v1/admin/ab-tests/:testKey/event
 */
export const trackEvent = async (req, res) => {
  try {
    const { userId, eventType, eventData } = req.body;

    await featureFlagService.trackEvent(
      req.params.testKey,
      userId,
      eventType,
      eventData
    );

    res.json({
      success: true,
      message: "Event tracked successfully",
    });
  } catch (error) {
    console.error("Track event error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
