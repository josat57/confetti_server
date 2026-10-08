import express from "express";
import { protect } from "../middleware/auth.js";
import {
  listMessages,
  sendMessage,
  getMessage,
  markAsRead,
  getConversation,
  deleteMessage,
  listConversations,
  createConversation,
  getConversationById,
  getConversationMessages,
  sendConversationMessage,
  markConversationAsRead,
  getUnreadMessageCount,
} from "../controllers/communication.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Message routes (mounted under /api/v1/planner/messages)
export const plannerMessageRoutes = express.Router();
plannerMessageRoutes.get("/", listMessages);
plannerMessageRoutes.post("/", sendMessage);
plannerMessageRoutes.get("/conversations/:userId", getConversation);

// Conversation inbox (mounted under /api/v1/messages). Declared before /:id so
// "conversations" and "unread-count" aren't read as message ids.
router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.get("/conversations/:id", getConversationById);
router.get("/conversations/:id/messages", getConversationMessages);
router.post("/conversations/:id/messages", sendConversationMessage);
router.patch("/conversations/:id/read", markConversationAsRead);
router.get("/unread-count", getUnreadMessageCount);

// General message routes (mounted under /api/v1/messages)
router.get("/:id", getMessage);
router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteMessage);

export default router;
