import express from "express";
import {
  getLatestReleases,
  getRelease,
  getFeaturedRelease,
  getUnreadReleases,
  getReleasesSince,
  markReleaseViewed,
  getChangelog,
} from "../controllers/whats-new.controller.js";
import { protect, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

// Public routes (optional auth for tracking)
router.get("/latest", optionalAuth, getLatestReleases);
router.get("/featured", optionalAuth, getFeaturedRelease);
router.get("/changelog", optionalAuth, getChangelog);
router.get("/since", optionalAuth, getReleasesSince);
router.get("/:version", optionalAuth, getRelease);

// Protected routes
router.use(protect);
router.get("/user/unread", getUnreadReleases);
router.post("/:version/viewed", markReleaseViewed);

export default router;
