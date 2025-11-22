import express from "express";
import {
  searchVendors,
  getVendorById,
  addVendorToFavorites,
  removeVendorFromFavorites,
  getFavoriteVendors,
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  cancelBooking,
} from "../controllers/planner-vendor.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/search", searchVendors);
router.get("/favorites", getFavoriteVendors);
router.get("/:id", getVendorById);
router.post("/:id/favorite", addVendorToFavorites);
router.delete("/:id/favorite", removeVendorFromFavorites);
router.post("/:id/book", createBooking);

export default router;

export const bookingRouter = express.Router();
bookingRouter.use(protect);

bookingRouter.get("/", getBookings);
bookingRouter.get("/:id", getBookingById);
bookingRouter.put("/:id", updateBooking);
bookingRouter.post("/:id/cancel", cancelBooking);
