import express from "express";
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  addClientNote,
  addClientFeedback,
} from "../controllers/planner-client.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/", createClient);
router.get("/", getClients);
router.get("/:id", getClientById);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);
router.post("/:id/notes", addClientNote);
router.post("/:id/feedback", addClientFeedback);

export default router;
