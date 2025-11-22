import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  sendQuote,
  duplicateQuote,
  markAsViewed,
  acceptQuote,
  rejectQuote,
  getQuoteStats,
  getExpiringQuotes,
  getPublicQuote,
} from "../controllers/quote.controller.js";

const router = express.Router();

// Public routes (no authentication required)
router.get("/:id/public", getPublicQuote);
router.post("/:id/view", markAsViewed);
router.post("/:id/accept", acceptQuote);
router.post("/:id/reject", rejectQuote);

// Protected routes (require authentication)
router.use(protect);

router.get("/stats", getQuoteStats);
router.get("/expiring", getExpiringQuotes);
router.get("/", getQuotes);
router.post("/", createQuote);
router.get("/:id", getQuote);
router.put("/:id", updateQuote);
router.delete("/:id", deleteQuote);
router.post("/:id/send", sendQuote);
router.post("/:id/duplicate", duplicateQuote);

export default router;
