import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  generateChecklist,
} from "../controllers/checklist.controller.js";

// Event checklist: /api/v1/events/:eventId/checklist
const router = express.Router({ mergeParams: true });
router.use(protect);

router.get("/", getChecklist);
router.post("/", addChecklistItem);
router.post("/generate", generateChecklist);
router.patch("/:taskId", updateChecklistItem);
router.delete("/:taskId", deleteChecklistItem);

export default router;
