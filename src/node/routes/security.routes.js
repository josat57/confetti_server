import express from "express";
import { protect } from "../middleware/auth.js";
import {
  enable2FA,
  verify2FA,
  disable2FA,
  getAuditLogs,
  exportAuditLogs,
  getSessions,
  revokeSession,
  revokeAllSessions,
  configureSSO,
} from "../controllers/security.controller.js";

const router = express.Router();

// All security routes require authentication
router.use(protect);

// Two-Factor Authentication
router.post("/2fa/enable", enable2FA);
router.post("/2fa/verify", verify2FA);
router.post("/2fa/disable", disable2FA);

// Audit Logs
router.get("/audit-logs", getAuditLogs);
router.get("/audit-logs/export", exportAuditLogs);

// Session Management
router.get("/sessions", getSessions);
router.delete("/sessions/:id", revokeSession);
router.delete("/sessions", revokeAllSessions);

// SSO Configuration (Enterprise only)
router.post("/sso/configure", configureSSO);

export default router;
