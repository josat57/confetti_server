import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationAnalytics,
} from "../controllers/location.controller.js";

const router = express.Router();

// All location routes require authentication
router.use(protect);

// Location management
router.get("/", getLocations);
router.post("/", createLocation);
router.get("/:id", getLocation);
router.put("/:id", updateLocation);
router.delete("/:id", deleteLocation);
router.get("/:id/analytics", getLocationAnalytics);

export default router;
