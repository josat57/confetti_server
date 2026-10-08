import express from "express";
import { protect } from "../middleware/auth.js";
import {
  uploadProfileImage,
  uploadCoverPhoto as uploadCoverPhotoMiddleware,
  uploadLogo,
} from "../middleware/upload.js";
import { requirePlanFeature } from "../services/plan-access.service.js";
import {
  getPlannerBranding,
  updatePlannerBranding,
  uploadPlannerLogo,
} from "../controllers/planner-branding.controller.js";
import subscriptionService from "../services/subscription.service.js";
// Reuse existing settings controller (works for both vendors and planners)
import {
  getSettings,
  updateProfile,
  uploadProfilePicture,
  uploadCoverPhoto,
  updateNotificationSettings,
  updatePreferences,
  exportUserData,
  deleteAccount,
} from "../controllers/settings.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Reuse existing settings endpoints (work for both vendors and planners)
router.get("/profile", getSettings);
router.put("/profile", updateProfile);
router.post("/profile/picture", uploadProfileImage, uploadProfilePicture);
router.post("/profile/cover", uploadCoverPhotoMiddleware, uploadCoverPhoto);
router.get("/preferences", getSettings);
router.put("/preferences", updatePreferences);
router.patch("/notifications", updateNotificationSettings);
router.get("/subscription", getSettings);

// Change plan from the planner settings page ({ tier, billingCycle: "monthly" | "annual" })
router.post("/subscription/upgrade", async (req, res, next) => {
  try {
    const { tier, planName, planId, billingCycle, paymentProvider, currency, couponCode } = req.body || {};
    const result = await subscriptionService.changePlan(req.user, {
      planId,
      planName: planName || tier,
      billingCycle,
      paymentProvider: paymentProvider || "flutterwave",
      currency,
      couponCode,
    });
    res.status(200).json({
      status: "success",
      data: {
        action: result.action,
        subscription: result.subscription,
        paymentUrl: result.paymentUrl,
        reference: result.reference,
        amountDue: result.amountDue,
        currency: result.currency,
        effectiveAt: result.effectiveAt,
      },
    });
  } catch (error) {
    next(error);
  }
});
router.post("/subscription/cancel", async (req, res, next) => {
  try {
    const subscription = await subscriptionService.cancelOwn(req.user, req.body || {});
    res.status(200).json({ status: "success", data: { subscription } });
  } catch (error) {
    next(error);
  }
});

// Branding on proposals and exports: changing it is an Agency feature
const brandedExports = requirePlanFeature("brandedExports", { label: "Branded proposals and exports" });
router.get("/branding", getPlannerBranding);
router.put("/branding", brandedExports, updatePlannerBranding);
router.post("/branding/logo", brandedExports, uploadLogo, uploadPlannerLogo);
router.get("/export-data", exportUserData);
router.delete("/account", deleteAccount);

export default router;
