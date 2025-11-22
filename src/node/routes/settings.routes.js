import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getSettings,
  updateNotificationSettings,
  updatePreferenceSettings,
  enable2FA,
  verify2FA,
  disable2FA,
  regenerateBackupCodes,
  initializePaymentMethod,
  verifyPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  changeSubscriptionPlan,
  getSecurityActivity,
  exportUserData,
} from "../controllers/settings.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// General settings
router.get("/", getSettings);
router.get("/export-data", exportUserData);

// Notification settings
router.patch("/notifications", updateNotificationSettings);

// Preference settings
router.patch("/preferences", updatePreferenceSettings);

// Security settings
router.get("/security/activity", getSecurityActivity);

// 2FA settings
router.post("/security/2fa/enable", enable2FA);
router.post("/security/2fa/verify", verify2FA);
router.post("/security/2fa/disable", disable2FA);
router.post("/security/2fa/backup-codes", regenerateBackupCodes);

// Billing settings
router.post("/billing/payment-methods/initialize", initializePaymentMethod);
router.post("/billing/payment-methods/verify", verifyPaymentMethod);
router.delete("/billing/payment-methods/:id", removePaymentMethod);
router.patch("/billing/payment-methods/:id/default", setDefaultPaymentMethod);
router.post("/billing/change-plan", changeSubscriptionPlan);

export default router;
