import express from "express";
import { authenticateAdmin, authorizeAdmin } from "../middleware/auth.js";
import {
  getBackups,
  getBackupById,
  createBackup,
  deleteBackup,
  restoreBackup,
  verifyBackup,
  downloadBackup,
  getBackupSchedules,
  getBackupScheduleById,
  createBackupSchedule,
  updateBackupSchedule,
  deleteBackupSchedule,
  toggleBackupSchedule,
  runScheduleNow,
  getStorageUsage,
  getDataExports,
  createDataExport,
  downloadDataExport,
  deleteDataExport,
  getDataImports,
  uploadDataImport,
  importUpload,
  getDataImportStatus,
  getRetentionPolicies,
  createRetentionPolicy,
  updateRetentionPolicy,
  deleteRetentionPolicy,
  cleanupOldBackups,
} from "../controllers/admin-backup.controller.js";

const router = express.Router();

router.use(authenticateAdmin);

// ─── BACKUPS ─────────────────────────────────────────────────────────────────
router.get(
  "/",
  authorizeAdmin(["system_configuration"]),
  getBackups
);
router.post(
  "/",
  authorizeAdmin(["system_configuration"]),
  createBackup
);
router.post(
  "/restore",
  authorizeAdmin(["system_configuration"]),
  restoreBackup
);
router.post(
  "/cleanup",
  authorizeAdmin(["system_configuration"]),
  cleanupOldBackups
);
router.get(
  "/storage",
  authorizeAdmin(["system_configuration", "analytics"]),
  getStorageUsage
);

// ─── SCHEDULES ───────────────────────────────────────────────────────────────
router.get(
  "/schedules",
  authorizeAdmin(["system_configuration"]),
  getBackupSchedules
);
router.post(
  "/schedules",
  authorizeAdmin(["system_configuration"]),
  createBackupSchedule
);
router.get(
  "/schedules/:scheduleId",
  authorizeAdmin(["system_configuration"]),
  getBackupScheduleById
);
router.put(
  "/schedules/:scheduleId",
  authorizeAdmin(["system_configuration"]),
  updateBackupSchedule
);
router.delete(
  "/schedules/:scheduleId",
  authorizeAdmin(["system_configuration"]),
  deleteBackupSchedule
);
router.patch(
  "/schedules/:scheduleId/toggle",
  authorizeAdmin(["system_configuration"]),
  toggleBackupSchedule
);
router.post(
  "/schedules/:scheduleId/run",
  authorizeAdmin(["system_configuration"]),
  runScheduleNow
);

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
router.get(
  "/exports",
  authorizeAdmin(["system_configuration", "analytics"]),
  getDataExports
);
router.post(
  "/exports",
  authorizeAdmin(["system_configuration"]),
  createDataExport
);
router.get(
  "/exports/:exportId/download",
  authorizeAdmin(["system_configuration"]),
  downloadDataExport
);
router.delete(
  "/exports/:exportId",
  authorizeAdmin(["system_configuration"]),
  deleteDataExport
);

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
router.get(
  "/imports",
  authorizeAdmin(["system_configuration"]),
  getDataImports
);
router.post(
  "/imports",
  authorizeAdmin(["system_configuration"]),
  importUpload.single("file"),
  uploadDataImport
);
router.get(
  "/imports/:importId",
  authorizeAdmin(["system_configuration"]),
  getDataImportStatus
);

// ─── RETENTION POLICIES ──────────────────────────────────────────────────────
router.get(
  "/retention",
  authorizeAdmin(["system_configuration", "security_compliance"]),
  getRetentionPolicies
);
router.post(
  "/retention",
  authorizeAdmin(["system_configuration"]),
  createRetentionPolicy
);
router.put(
  "/retention/:policyId",
  authorizeAdmin(["system_configuration"]),
  updateRetentionPolicy
);
router.delete(
  "/retention/:policyId",
  authorizeAdmin(["system_configuration"]),
  deleteRetentionPolicy
);

// ─── INDIVIDUAL BACKUP OPS (parameterised — must come after static routes) ───
router.get(
  "/:backupId",
  authorizeAdmin(["system_configuration"]),
  getBackupById
);
router.delete(
  "/:backupId",
  authorizeAdmin(["system_configuration"]),
  deleteBackup
);
router.post(
  "/:backupId/verify",
  authorizeAdmin(["system_configuration"]),
  verifyBackup
);
router.get(
  "/:backupId/download",
  authorizeAdmin(["system_configuration"]),
  downloadBackup
);

export default router;
