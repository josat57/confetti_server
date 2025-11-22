import express from "express";
import { protect } from "../middleware/auth.js";
import {
  listEventGuests,
  addGuest,
  importGuests,
  getGuest,
  updateGuest,
  deleteGuest,
  updateRSVP,
  getSeatingChart,
  updateSeating,
} from "../controllers/guest.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Event-specific guest routes (mounted under /api/v1/events/:eventId/guests)
export const eventGuestRoutes = express.Router({ mergeParams: true });
eventGuestRoutes.get("/", listEventGuests);
eventGuestRoutes.post("/", addGuest);
eventGuestRoutes.post("/import", importGuests);

// Event seating routes (mounted under /api/v1/events/:eventId/seating)
export const eventSeatingRoutes = express.Router({ mergeParams: true });
eventSeatingRoutes.get("/", getSeatingChart);
eventSeatingRoutes.post("/", updateSeating);

// General guest routes (mounted under /api/v1/guests)
router.get("/:id", getGuest);
router.patch("/:id", updateGuest);
router.delete("/:id", deleteGuest);
router.post("/:id/rsvp", updateRSVP);

export default router;
