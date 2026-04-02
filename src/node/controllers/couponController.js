import couponService from "../services/couponService.js";

// ==================== COUPON MANAGEMENT ====================

/**
 * Get all coupons
 * GET /api/v1/admin/coupons
 */
export const getCoupons = async (req, res) => {
  try {
    const result = await couponService.getCoupons(req.query);

    res.json({
      success: true,
      data: result.coupons,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get coupons error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
      error: error.message,
    });
  }
};

/**
 * Get coupon by ID
 * GET /api/v1/admin/coupons/:id
 */
export const getCouponById = async (req, res) => {
  try {
    const coupon = await couponService.getCouponById(req.params.id);

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    console.error("Get coupon error:", error);
    res.status(error.message === "Coupon not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create coupon
 * POST /api/v1/admin/coupons
 */
export const createCoupon = async (req, res) => {
  try {
    const coupon = await couponService.createCoupon(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  } catch (error) {
    console.error("Create coupon error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create bulk coupons
 * POST /api/v1/admin/coupons/bulk
 */
export const createBulkCoupons = async (req, res) => {
  try {
    const { count, ...couponData } = req.body;

    if (!count || count < 1 || count > 1000) {
      return res.status(400).json({
        success: false,
        message: "Count must be between 1 and 1000",
      });
    }

    const result = await couponService.createBulkCoupons(
      couponData,
      count,
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: `${result.count} coupons created successfully`,
      data: result,
    });
  } catch (error) {
    console.error("Create bulk coupons error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update coupon
 * PUT /api/v1/admin/coupons/:id
 */
export const updateCoupon = async (req, res) => {
  try {
    const coupon = await couponService.updateCoupon(
      req.params.id,
      req.body,
      req.user._id
    );

    res.json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(error.message === "Coupon not found" ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete coupon
 * DELETE /api/v1/admin/coupons/:id
 */
export const deleteCoupon = async (req, res) => {
  try {
    const result = await couponService.deleteCoupon(req.params.id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(error.message === "Coupon not found" ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Toggle coupon status
 * POST /api/v1/admin/coupons/:id/toggle
 */
export const toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await couponService.toggleCouponStatus(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      message: `Coupon ${
        coupon.status === "active" ? "activated" : "deactivated"
      } successfully`,
      data: coupon,
    });
  } catch (error) {
    console.error("Toggle coupon status error:", error);
    res.status(error.message === "Coupon not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Validate coupon
 * POST /api/v1/admin/coupons/validate
 */
export const validateCoupon = async (req, res) => {
  try {
    const { code, userId, userType, subscriptionTier, amount } = req.body;

    const validation = await couponService.validateCoupon(
      code,
      userId,
      userType,
      subscriptionTier,
      amount
    );

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error("Validate coupon error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get coupon analytics
 * GET /api/v1/admin/coupons/:id/analytics
 */
export const getCouponAnalytics = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analytics = await couponService.getCouponAnalytics(
      req.params.id,
      days
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Get coupon analytics error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Generate coupon codes
 * POST /api/v1/admin/coupons/generate-codes
 */
export const generateCouponCodes = async (req, res) => {
  try {
    const { count, prefix, length } = req.body;

    if (!count || count < 1 || count > 100) {
      return res.status(400).json({
        success: false,
        message: "Count must be between 1 and 100",
      });
    }

    const codes = await couponService.generateUniqueCodes(
      count,
      prefix || "",
      length || 8
    );

    res.json({
      success: true,
      data: { codes },
    });
  } catch (error) {
    console.error("Generate coupon codes error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== PROMOTION MANAGEMENT ====================

/**
 * Get all promotions
 * GET /api/v1/admin/promotions
 */
export const getPromotions = async (req, res) => {
  try {
    const result = await couponService.getPromotions(req.query);

    res.json({
      success: true,
      data: result.promotions,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get promotions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch promotions",
      error: error.message,
    });
  }
};

/**
 * Get promotion by ID
 * GET /api/v1/admin/promotions/:id
 */
export const getPromotionById = async (req, res) => {
  try {
    const promotion = await couponService.getPromotionById(req.params.id);

    res.json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    console.error("Get promotion error:", error);
    res.status(error.message === "Promotion not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create promotion
 * POST /api/v1/admin/promotions
 */
export const createPromotion = async (req, res) => {
  try {
    const promotion = await couponService.createPromotion(
      req.body,
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: "Promotion created successfully",
      data: promotion,
    });
  } catch (error) {
    console.error("Create promotion error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update promotion
 * PUT /api/v1/admin/promotions/:id
 */
export const updatePromotion = async (req, res) => {
  try {
    const promotion = await couponService.updatePromotion(
      req.params.id,
      req.body,
      req.user._id
    );

    res.json({
      success: true,
      message: "Promotion updated successfully",
      data: promotion,
    });
  } catch (error) {
    console.error("Update promotion error:", error);
    res.status(error.message === "Promotion not found" ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete promotion
 * DELETE /api/v1/admin/promotions/:id
 */
export const deletePromotion = async (req, res) => {
  try {
    const result = await couponService.deletePromotion(req.params.id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete promotion error:", error);
    res.status(error.message === "Promotion not found" ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Start promotion
 * POST /api/v1/admin/promotions/:id/start
 */
export const startPromotion = async (req, res) => {
  try {
    const promotion = await couponService.startPromotion(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      message: "Promotion started successfully",
      data: promotion,
    });
  } catch (error) {
    console.error("Start promotion error:", error);
    res.status(error.message === "Promotion not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Pause promotion
 * POST /api/v1/admin/promotions/:id/pause
 */
export const pausePromotion = async (req, res) => {
  try {
    const promotion = await couponService.pausePromotion(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      message: "Promotion paused successfully",
      data: promotion,
    });
  } catch (error) {
    console.error("Pause promotion error:", error);
    res.status(error.message === "Promotion not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Complete promotion
 * POST /api/v1/admin/promotions/:id/complete
 */
export const completePromotion = async (req, res) => {
  try {
    const promotion = await couponService.completePromotion(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      message: "Promotion completed successfully",
      data: promotion,
    });
  } catch (error) {
    console.error("Complete promotion error:", error);
    res.status(error.message === "Promotion not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Track promotion impression
 * POST /api/v1/admin/promotions/:id/track/impression
 */
export const trackImpression = async (req, res) => {
  try {
    await couponService.trackImpression(req.params.id);

    res.json({
      success: true,
      message: "Impression tracked successfully",
    });
  } catch (error) {
    console.error("Track impression error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Track promotion click
 * POST /api/v1/admin/promotions/:id/track/click
 */
export const trackClick = async (req, res) => {
  try {
    await couponService.trackClick(req.params.id);

    res.json({
      success: true,
      message: "Click tracked successfully",
    });
  } catch (error) {
    console.error("Track click error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Track promotion conversion
 * POST /api/v1/admin/promotions/:id/track/conversion
 */
export const trackConversion = async (req, res) => {
  try {
    const { revenue } = req.body;
    await couponService.trackConversion(req.params.id, revenue || 0);

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
 * Get promotion analytics
 * GET /api/v1/admin/promotions/:id/analytics
 */
export const getPromotionAnalytics = async (req, res) => {
  try {
    const analytics = await couponService.getPromotionAnalytics(req.params.id);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Get promotion analytics error:", error);
    res.status(error.message === "Promotion not found" ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
};
