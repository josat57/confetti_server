import express from "express";
import { protect } from "../middleware/auth.js";
import { requireEventPass } from "../services/plan-access.service.js";
import { getInvitation, saveInvitation, sendInvitations } from "../controllers/invitation.controller.js";

// Digital invitations: /api/v1/events/:eventId/invitation (clients need an event pass)
const router = express.Router({ mergeParams: true });
router.use(protect);

const invites = requireEventPass("invites", { label: "Digital invitations" });
router.get("/", getInvitation);
router.put("/", invites, saveInvitation);
router.post("/send", invites, sendInvitations);

export default router;
