import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import {
  listVendorBookings,
  getVendorBookingStats,
  getUpcomingVendorBookings,
  getBookingsByDateRange,
  getVendorBooking,
  createVendorBooking,
  updateVendorBooking,
  deleteVendorBooking,
  updateVendorBookingStatus,
  confirmVendorBooking,
  cancelVendorBooking,
  completeVendorBooking,
  addVendorBookingNote,
  recordVendorBookingPayment,
  markVendorDepositPaid,
  sendVendorBookingConfirmation,
  generateVendorContract,
  downloadVendorContract,
  markVendorContractSigned,
} from "../controllers/vendor-booking.controller.js";

// Vendor bookings: /api/v1/vendors/bookings
const router = express.Router();
router.use(protect, restrictTo("vendor"));

router.get("/", listVendorBookings);
router.post("/", createVendorBooking);
router.get("/stats", getVendorBookingStats);
router.get("/upcoming", getUpcomingVendorBookings);
router.get("/date-range", getBookingsByDateRange);
router.get("/:id", getVendorBooking);
router.put("/:id", updateVendorBooking);
router.delete("/:id", deleteVendorBooking);
router.patch("/:id/status", updateVendorBookingStatus);
router.post("/:id/confirm", confirmVendorBooking);
router.post("/:id/cancel", cancelVendorBooking);
router.post("/:id/complete", completeVendorBooking);
router.post("/:id/notes", addVendorBookingNote);
router.post("/:id/payments", recordVendorBookingPayment);
router.post("/:id/deposit", markVendorDepositPaid);
router.post("/:id/send-confirmation", sendVendorBookingConfirmation);
router.post("/:id/contract", generateVendorContract);
router.get("/:id/contract.pdf", downloadVendorContract);
router.post("/:id/contract/signed", markVendorContractSigned);

export default router;
