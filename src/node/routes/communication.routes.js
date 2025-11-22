import express from "express";
import { protect } from "../middleware/auth.js";
import {
  listMessages,
  sendMessage,
  getMessage,
  markAsRead,
  getConversation,
  deleteMessage,
} from "../controllers/communication.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Message routes (mounted under /api/v1/planner/messages)
export const plannerMessageRoutes = express.Router();
plannerMessageRoutes.get("/", listMessages);
plannerMessageRoutes.post("/", sendMessage);
plannerMessageRoutes.get("/conversations/:userId", getConversation);

// General message routes (mounted under /api/v1/messages)
router.get("/:id", getMessage);
router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteMessage);

export default router;
