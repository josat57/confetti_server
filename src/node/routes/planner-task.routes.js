import express from "express";
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  completeTask,
  addComment,
  getUpcomingTasks,
  getOverdueTasks,
} from "../controllers/planner-task.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/", createTask);
router.get("/", getTasks);
router.get("/upcoming", getUpcomingTasks);
router.get("/overdue", getOverdueTasks);
router.get("/:id", getTaskById);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);
router.patch("/:id/complete", completeTask);
router.post("/:id/comments", addComment);

export default router;
