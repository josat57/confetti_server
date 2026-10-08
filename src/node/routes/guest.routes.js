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
  updateSeatingTables,
} from "../controllers/guest.controller.js";
import { getGuestRsvpLink, markInvitationShared } from "../controllers/invitation.controller.js";
import { requireEventPass } from "../services/plan-access.service.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Event-specific guest routes (mounted under /api/v1/events/:eventId/guests)
export const eventGuestRoutes = express.Router({ mergeParams: true });
eventGuestRoutes.use(protect);
eventGuestRoutes.get("/", listEventGuests);
eventGuestRoutes.post("/", addGuest);
eventGuestRoutes.post("/import", importGuests);
// RSVP links and WhatsApp sharing (clients need an event pass)
eventGuestRoutes.get(
  "/:guestId/rsvp-link",
  requireEventPass("rsvp", { label: "RSVP links" }),
  getGuestRsvpLink
);
eventGuestRoutes.post(
  "/:guestId/invitation/shared",
  requireEventPass("invites", { label: "Digital invitations" }),
  markInvitationShared
);

// Event seating routes (mounted under /api/v1/events/:eventId/seating)
export const eventSeatingRoutes = express.Router({ mergeParams: true });
eventSeatingRoutes.use(protect);
eventSeatingRoutes.get("/", getSeatingChart);
eventSeatingRoutes.post("/", updateSeating);
eventSeatingRoutes.put("/tables", updateSeatingTables);

// General guest routes (mounted under /api/v1/guests)
router.get("/:id", getGuest);
router.patch("/:id", updateGuest);
router.delete("/:id", deleteGuest);
router.post("/:id/rsvp", updateRSVP);

export default router;
