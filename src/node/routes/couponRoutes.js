import express from "express";
import * as couponController from "../controllers/couponController.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(restrictTo("admin", "super_admin"));

// ==================== COUPON ROUTES ====================

// Get all coupons
router.get("/coupons", couponController.getCoupons);

// Generate coupon codes
router.post("/coupons/generate-codes", couponController.generateCouponCodes);

// Create bulk coupons
router.post("/coupons/bulk", couponController.createBulkCoupons);

// Validate coupon
router.post("/coupons/validate", couponController.validateCoupon);

// Get coupon by ID
router.get("/coupons/:id", couponController.getCouponById);

// Create coupon
router.post("/coupons", couponController.createCoupon);

// Update coupon
router.put("/coupons/:id", couponController.updateCoupon);

// Delete coupon
router.delete("/coupons/:id", couponController.deleteCoupon);

// Toggle coupon status
router.post("/coupons/:id/toggle", couponController.toggleCouponStatus);

// Get coupon analytics
router.get("/coupons/:id/analytics", couponController.getCouponAnalytics);

// ==================== PROMOTION ROUTES ====================

// Get all promotions
router.get("/promotions", couponController.getPromotions);

// Get promotion by ID
router.get("/promotions/:id", couponController.getPromotionById);

// Create promotion
router.post("/promotions", couponController.createPromotion);

// Update promotion
router.put("/promotions/:id", couponController.updatePromotion);

// Delete promotion
router.delete("/promotions/:id", couponController.deletePromotion);

// Start promotion
router.post("/promotions/:id/start", couponController.startPromotion);

// Pause promotion
router.post("/promotions/:id/pause", couponController.pausePromotion);

// Complete promotion
router.post("/promotions/:id/complete", couponController.completePromotion);

// Track impression
router.post(
  "/promotions/:id/track/impression",
  couponController.trackImpression
);

// Track click
router.post("/promotions/:id/track/click", couponController.trackClick);

// Track conversion
router.post(
  "/promotions/:id/track/conversion",
  couponController.trackConversion
);

// Get promotion analytics
router.get("/promotions/:id/analytics", couponController.getPromotionAnalytics);

export default router;
