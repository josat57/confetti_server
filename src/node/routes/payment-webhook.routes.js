import express from "express";
import {
  handleFlutterwaveWebhook,
  handlePaystackWebhook,
} from "../controllers/payment-webhook.controller.js";

const router = express.Router();

// Webhook routes (no authentication required - verified by signature)
router.post("/flutterwave", handleFlutterwaveWebhook);
router.post("/paystack", handlePaystackWebhook);

export default router;
