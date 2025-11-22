import express from "express";
import {
  healthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
  databaseStats,
  apiMetrics,
} from "../controllers/health.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public health checks (no authentication required)
router.get("/", healthCheck);
router.get("/ready", readinessCheck);
router.get("/live", livenessCheck);

// Detailed health checks (authentication required)
router.get("/detailed", protect, detailedHealthCheck);
router.get("/database", protect, databaseStats);
router.get("/metrics", protect, apiMetrics);

export default router;
