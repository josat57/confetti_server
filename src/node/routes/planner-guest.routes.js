import express from "express";
import {
  createGuest,
  getGuests,
  getGuestById,
  updateGuest,
  deleteGuest,
  updateRSVP,
  checkInGuest,
  getGuestStats,
  importGuests,
} from "../controllers/planner-guest.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/", createGuest);
router.get("/", getGuests);
router.post("/import", importGuests);
router.get("/:id", getGuestById);
router.put("/:id", updateGuest);
router.delete("/:id", deleteGuest);
router.patch("/:id/rsvp", updateRSVP);
router.patch("/:id/checkin", checkInGuest);

export default router;

export const eventGuestStatsRouter = express.Router({ mergeParams: true });
eventGuestStatsRouter.use(protect);
eventGuestStatsRouter.get("/", getGuestStats);
