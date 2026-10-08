import express from "express";
import {
  searchVendors,
  getVendorById,
  addVendorToFavorites,
  removeVendorFromFavorites,
  getFavoriteVendors,
  createBooking,
  getBookings,
  getBookingStats,
  getBookingById,
  updateBooking,
  cancelBooking,
  getVendorCategories,
} from "../controllers/planner-vendor.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, restrictTo("event-planner", "user"));

router.get("/search", searchVendors);
router.get("/categories", getVendorCategories);
router.get("/favorites", getFavoriteVendors);
router.get("/:id", getVendorById);
router.post("/:id/favorite", addVendorToFavorites);
router.delete("/:id/favorite", removeVendorFromFavorites);
router.post("/:id/book", createBooking);

export default router;

export const bookingRouter = express.Router();
bookingRouter.use(protect, restrictTo("event-planner", "user"));

bookingRouter.get("/", getBookings);
bookingRouter.post("/", createBooking);
// Stats route MUST come before /:id to avoid route conflict
bookingRouter.get("/stats", getBookingStats);
bookingRouter.get("/:id", getBookingById);
bookingRouter.put("/:id", updateBooking);
bookingRouter.post("/:id/cancel", cancelBooking);
