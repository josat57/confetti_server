import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  addNote,
  updateTags,
  getClientHistory,
  deleteClient,
} from "../controllers/crm.controller.js";

const router = express.Router();

// All CRM routes require authentication
router.use(protect);

router.get("/", getClients);
router.post("/", createClient);
router.get("/:id", getClient);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);
router.post("/:id/notes", addNote);
router.put("/:id/tags", updateTags);
router.get("/:id/history", getClientHistory);

export default router;
