import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getInvoices,
  getInvoice,
  createInvoice,
  sendInvoice,
  recordPayment,
  getPaymentHistory,
  getPendingPayments,
} from "../controllers/payment.controller.js";

const router = express.Router();

// All payment routes require authentication
router.use(protect);

router.get("/invoices", getInvoices);
router.post("/invoices", createInvoice);
router.get("/invoices/:id", getInvoice);
router.post("/invoices/:id/send", sendInvoice);
router.post("/invoices/:id/payment", recordPayment);
router.get("/payments", getPaymentHistory);
router.get("/payments/pending", getPendingPayments);

export default router;
