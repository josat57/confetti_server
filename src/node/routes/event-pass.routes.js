import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getPassCatalogue,
  getMyPasses,
  startPassCheckout,
  passPaymentCallback,
} from "../controllers/event-pass.controller.js";

// Event passes: /api/v1/event-passes
const router = express.Router();

router.get("/catalogue", getPassCatalogue);
router.get("/callback", passPaymentCallback); // payment provider redirect (no login)

router.use(protect);
router.get("/", getMyPasses);
router.post("/checkout", startPassCheckout);

export default router;
