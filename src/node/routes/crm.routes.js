import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getClients,
  getNewClientForm,
  getClient,
  createClient,
  updateClient,
  addNote,
  updateTags,
  updateFollowUp,
  getClientHistory,
  deleteClient,
} from "../controllers/crm.controller.js";

const router = express.Router();

// All CRM routes require authentication
router.use(protect);

router.get("/", getClients);
router.post("/", createClient);
// Specific routes MUST come before /:id to avoid route conflicts
router.get("/new", getNewClientForm);
router.get("/:id", getClient);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);
router.post("/:id/notes", addNote);
router.put("/:id/tags", updateTags);
router.patch("/:id/follow-up", updateFollowUp);
router.get("/:id/history", getClientHistory);

export default router;
