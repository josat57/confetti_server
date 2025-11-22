import express from "express";
import multer from "multer";
import {
  exportAllData,
  exportEvents,
  exportClients,
  exportGuestsCSV,
  exportTasks,
  importGuestsCSV,
  validateCSV,
  downloadCSVTemplate,
} from "../controllers/data-exchange.controller.js";
import { protect } from "../middleware/auth.js";
import { restrictTo } from "../middleware/auth.js";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// All routes require authentication
router.use(protect);
router.use(restrictTo("event-planner"));

// Export routes
router.get("/export/all", exportAllData);
router.get("/export/events", exportEvents);
router.get("/export/clients", exportClients);
router.get("/export/guests/csv", exportGuestsCSV);
router.get("/export/tasks", exportTasks);

// Import routes
router.post("/import/guests/csv", upload.single("file"), importGuestsCSV);
router.post("/import/validate", upload.single("file"), validateCSV);

// Template download
router.get("/import/template/guests", downloadCSVTemplate);

export default router;
