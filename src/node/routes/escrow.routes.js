import express from "express";
import { protect, restrictTo, authenticateAdmin, authorizeAdmin } from "../middleware/auth.js";
import {
  getBanks,
  startEscrowCheckout,
  getBookingPayments,
  confirmDelivery,
  openDispute,
  escrowPaymentCallback,
  getVendorPayouts,
  getVendorPayoutAccount,
  updateVendorPayoutAccount,
  adminListEscrow,
  adminEscrowReport,
  adminResolveEscrow,
  adminRetryPayout,
  adminMarkPayoutPaid,
} from "../controllers/escrow.controller.js";

// Booking payments held by Confetti: /api/v1/escrow
const router = express.Router();
router.get("/callback", escrowPaymentCallback); // payment provider redirect (no login)
router.use(protect);
router.get("/banks", getBanks);
router.post("/checkout", restrictTo("user", "event-planner"), startEscrowCheckout);
router.get("/bookings/:bookingId", getBookingPayments);
router.post("/:id/confirm", confirmDelivery);
router.post("/:id/dispute", openDispute);

// Vendor payouts: /api/v1/vendors/payouts
export const vendorPayoutRoutes = express.Router();
vendorPayoutRoutes.use(protect, restrictTo("vendor"));
vendorPayoutRoutes.get("/", getVendorPayouts);
vendorPayoutRoutes.get("/account", getVendorPayoutAccount);
vendorPayoutRoutes.put("/account", updateVendorPayoutAccount);

// Admin: /api/v1/admin/escrow
export const adminEscrowRoutes = express.Router();
adminEscrowRoutes.use(authenticateAdmin, authorizeAdmin(["financial_oversight"]));
adminEscrowRoutes.get("/", adminListEscrow);
adminEscrowRoutes.get("/report", adminEscrowReport);
adminEscrowRoutes.post("/:id/resolve", adminResolveEscrow);
adminEscrowRoutes.post("/:id/payout/retry", adminRetryPayout);
adminEscrowRoutes.post("/:id/payout/mark-paid", adminMarkPayoutPaid);

export default router;
