import express from "express";
import { protect } from "../middleware/auth.js";
import {
  uploadProfileImage,
  uploadCoverPhoto as uploadCoverPhotoMiddleware,
} from "../middleware/upload.js";
// Reuse existing settings controller (works for both vendors and planners)
import {
  getSettings,
  updateProfile,
  uploadProfilePicture,
  uploadCoverPhoto,
  updateNotificationSettings,
  updatePreferences,
  exportUserData,
  deleteAccount,
} from "../controllers/settings.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Reuse existing settings endpoints (work for both vendors and planners)
router.get("/profile", getSettings);
router.put("/profile", updateProfile);
router.post("/profile/picture", uploadProfileImage, uploadProfilePicture);
router.post("/profile/cover", uploadCoverPhotoMiddleware, uploadCoverPhoto);
router.get("/preferences", getSettings);
router.put("/preferences", updatePreferences);
router.patch("/notifications", updateNotificationSettings);
router.get("/subscription", getSettings);
router.get("/export-data", exportUserData);
router.delete("/account", deleteAccount);

export default router;
