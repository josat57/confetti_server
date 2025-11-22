import express from "express";
import { protect } from "../middleware/auth.js";
import {
  listEventTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  completeTask,
} from "../controllers/task.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Event-specific task routes (mounted under /api/v1/events/:eventId/tasks)
export const eventTaskRoutes = express.Router({ mergeParams: true });
eventTaskRoutes.get("/", listEventTasks);
eventTaskRoutes.post("/", createTask);

// General task routes (mounted under /api/v1/tasks)
router.get("/:id", getTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);
router.post("/:id/complete", completeTask);

export default router;
