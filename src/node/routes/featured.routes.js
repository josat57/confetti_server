import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import { getBoostOverview, startBoostCheckout, useBoostCredit, boostPaymentCallback } from "../controllers/featured.controller.js";

// Payment provider redirect: /api/v1/featured/callback
export const featuredCallbackRoutes = express.Router();
featuredCallbackRoutes.get("/callback", boostPaymentCallback);

// Vendor boosts: /api/v1/vendors/boost
const router = express.Router();
router.use(protect, restrictTo("vendor"));
router.get("/", getBoostOverview);
router.post("/checkout", startBoostCheckout);
router.post("/use-credit", useBoostCredit);

export default router;
