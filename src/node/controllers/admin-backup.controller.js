import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import multer from "multer";
import csvParser from "csv-parser";
import Backup from "../models/Backup.model.js";
import BackupSchedule from "../models/BackupSchedule.model.js";
import DataExport from "../models/DataExport.model.js";
import DataImport from "../models/DataImport.model.js";
import DataRetentionPolicy from "../models/dataRetentionPolicy.model.js";
import { createError } from "../utils/error.js";
import { logger } from "../utils/logger.js";
import {
  BACKUP_DIR,
  startBackup,
  prepareRestore,
  runRestore,
  hashFile,
  isRestorable,
  deleteBackupFiles,
  runScheduledBackup,
  cleanupScheduleBackups,
  cleanupSafetyBackups,
} from "../services/backup.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, "../../../data/exports");
const IMPORT_DIR = path.join(__dirname, "../../../data/imports");

for (const dir of [BACKUP_DIR, EXPORT_DIR, IMPORT_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Multer setup for import uploads
const importStorage = multer.diskStorage({
  destination: IMPORT_DIR,
  filename: (_req, file, cb) => cb(null, `import-${Date.now()}-${file.originalname}`),
});
export const importUpload = multer({
  storage: importStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (["text/csv", "application/json", "text/plain"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only CSV and JSON files are allowed"));
  },
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const getDb = () => mongoose.connection.db;

const BACKUP_TYPES = ["full", "incremental", "differential"];

const validateCollectionsParam = (collections) =>
  collections === undefined ||
  (Array.isArray(collections) && collections.every((c) => typeof c === "string"));

const generateCsv = (documents, fields) => {
  if (!documents.length) return fields.join(",") + "\n";
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = documents.map((doc) => fields.map((f) => escape(doc[f])).join(","));
  return [fields.join(","), ...rows].join("\n");
};

// ─── BACKUPS ─────────────────────────────────────────────────────────────────

export const getBackups = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type, startDate, endDate } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [backups, total] = await Promise.all([
      Backup.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Backup.countDocuments(filter),
    ]);

    res.json({
      status: "success",
      data: {
        backups,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBackupById = async (req, res, next) => {
  try {
    const backup = await Backup.findById(req.params.backupId).lean();
    if (!backup) return next(createError(404, "Backup not found"));
    res.json({ status: "success", data: { backup } });
  } catch (error) {
    next(error);
  }
};

export const createBackup = async (req, res, next) => {
  try {
    const { name, description, type = "full", databases = [], collections = [] } = req.body;
    if (!name) return next(createError(400, "Backup name is required"));
    if (!BACKUP_TYPES.includes(type)) {
      return next(createError(400, `type must be one of: ${BACKUP_TYPES.join(", ")}`));
    }
    if (!validateCollectionsParam(collections)) {
      return next(createError(400, "collections must be an array of collection names"));
    }

    // Runs in the background; outcome is recorded on the backup document
    const { backup } = await startBackup({
      name,
      description,
      type,
      databases,
      collections,
      createdBy: req.admin._id,
      trigger: "manual",
    });

    res.status(202).json({
      status: "success",
      message: "Backup started",
      data: { backup },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBackup = async (req, res, next) => {
  try {
    const backup = await Backup.findById(req.params.backupId);
    if (!backup) return next(createError(404, "Backup not found"));
    if (backup.status === "running" || backup.status === "restoring") {
      return next(createError(400, "Cannot delete a backup that is currently in progress"));
    }

    await deleteBackupFiles(backup);
    await backup.deleteOne();

    res.json({ status: "success", message: "Backup deleted" });
  } catch (error) {
    next(error);
  }
};

export const restoreBackup = async (req, res, next) => {
  try {
    const { backupId, collections: targetCollections } = req.body;
    if (!backupId) return next(createError(400, "backupId is required"));
    if (!mongoose.isValidObjectId(backupId)) return next(createError(400, "Invalid backupId"));

    let prepared;
    try {
      prepared = await prepareRestore(backupId, targetCollections);
    } catch (err) {
      if (err.statusCode) return next(createError(err.statusCode, err.message));
      throw err;
    }

    // Runs in the background: safety snapshot → stage → swap
    runRestore(prepared.backup, prepared.collections, req.admin._id).catch((err) =>
      logger.error(`Restore job crashed: ${err.message}`)
    );

    res.json({
      status: "success",
      message:
        "Restore initiated. A safety snapshot of the affected collections is taken first. This may take a few minutes.",
      data: { backupId, collections: prepared.collections },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyBackup = async (req, res, next) => {
  try {
    const backup = await Backup.findById(req.params.backupId);
    if (!backup) return next(createError(404, "Backup not found"));
    if (!backup.filePath || !fs.existsSync(backup.filePath)) {
      return res.json({ status: "success", valid: false, message: "Backup file not found on disk" });
    }

    const checksum = await hashFile(backup.filePath);
    const valid = checksum === backup.checksum;

    res.json({
      status: "success",
      valid,
      restorable: valid && isRestorable(backup),
      message: valid ? "Backup integrity verified" : "Backup file is corrupted (checksum mismatch)",
    });
  } catch (error) {
    next(error);
  }
};

export const downloadBackup = async (req, res, next) => {
  try {
    const backup = await Backup.findById(req.params.backupId);
    if (!backup) return next(createError(404, "Backup not found"));
    if (!backup.filePath || !fs.existsSync(backup.filePath)) {
      return next(createError(404, "Backup file not available for download"));
    }

    const ndjson = isRestorable(backup);
    const safeName = String(backup.name).replace(/[^\w.-]+/g, "_");
    const filename = `backup-${safeName}-${backup._id}.${ndjson ? "ndjson" : "json"}`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", ndjson ? "application/x-ndjson" : "application/json");
    const stream = fs.createReadStream(backup.filePath);
    stream.on("error", next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

// ─── BACKUP SCHEDULES ────────────────────────────────────────────────────────

export const getBackupSchedules = async (req, res, next) => {
  try {
    const schedules = await BackupSchedule.find()
      .sort({ createdAt: -1 })
      .populate("lastBackup", "status completedAt fileSize")
      .lean();
    res.json({ status: "success", data: { schedules } });
  } catch (error) {
    next(error);
  }
};

export const getBackupScheduleById = async (req, res, next) => {
  try {
    const schedule = await BackupSchedule.findById(req.params.scheduleId)
      .populate("lastBackup")
      .lean();
    if (!schedule) return next(createError(404, "Schedule not found"));
    res.json({ status: "success", data: { schedule } });
  } catch (error) {
    next(error);
  }
};

export const createBackupSchedule = async (req, res, next) => {
  try {
    const { name, description, type, frequency, retentionDays, databases, collections } = req.body;
    if (!name || !frequency) return next(createError(400, "Name and frequency are required"));

    const schedule = new BackupSchedule({
      name,
      description,
      type: type || "full",
      frequency,
      retentionDays: retentionDays || 30,
      databases,
      collections,
      createdBy: req.admin._id,
    });
    schedule.nextRun = schedule.computeNextRun();
    await schedule.save();

    res.status(201).json({ status: "success", message: "Backup schedule created", data: { schedule } });
  } catch (error) {
    next(error);
  }
};

export const updateBackupSchedule = async (req, res, next) => {
  try {
    const { name, description, type, frequency, retentionDays, databases, collections } = req.body;
    const schedule = await BackupSchedule.findById(req.params.scheduleId);
    if (!schedule) return next(createError(404, "Schedule not found"));

    if (name !== undefined) schedule.name = name;
    if (description !== undefined) schedule.description = description;
    if (type !== undefined) schedule.type = type;
    if (retentionDays !== undefined) schedule.retentionDays = retentionDays;
    if (databases !== undefined) schedule.databases = databases;
    if (collections !== undefined) schedule.collections = collections;
    if (frequency !== undefined) {
      schedule.frequency = frequency;
      schedule.nextRun = schedule.computeNextRun();
    }

    await schedule.save();
    res.json({ status: "success", message: "Schedule updated", data: { schedule } });
  } catch (error) {
    next(error);
  }
};

export const deleteBackupSchedule = async (req, res, next) => {
  try {
    const schedule = await BackupSchedule.findByIdAndDelete(req.params.scheduleId);
    if (!schedule) return next(createError(404, "Schedule not found"));
    res.json({ status: "success", message: "Schedule deleted" });
  } catch (error) {
    next(error);
  }
};

export const toggleBackupSchedule = async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const schedule = await BackupSchedule.findById(req.params.scheduleId);
    if (!schedule) return next(createError(404, "Schedule not found"));
    schedule.isEnabled = enabled;
    if (enabled) schedule.nextRun = schedule.computeNextRun();
    await schedule.save();
    res.json({ status: "success", message: `Schedule ${enabled ? "enabled" : "disabled"}` });
  } catch (error) {
    next(error);
  }
};

export const runScheduleNow = async (req, res, next) => {
  try {
    const schedule = await BackupSchedule.findById(req.params.scheduleId);
    if (!schedule) return next(createError(404, "Schedule not found"));

    const running = await Backup.exists({ schedule: schedule._id, status: "running" });
    if (running) return next(createError(409, "A backup for this schedule is already running"));

    // Outcome (lastStatus / lastBackup) is recorded on the schedule when the job finishes
    const { backup } = await runScheduledBackup(schedule, { manual: true });
    if (schedule.isEnabled) {
      schedule.nextRun = schedule.computeNextRun();
      await BackupSchedule.findByIdAndUpdate(schedule._id, { nextRun: schedule.nextRun });
    }

    res.status(202).json({
      status: "success",
      message: "Backup started",
      data: { backup },
    });
  } catch (error) {
    next(error);
  }
};

// ─── STORAGE USAGE ───────────────────────────────────────────────────────────

export const getStorageUsage = async (req, res, next) => {
  try {
    const db = getDb();
    const dbStats = await db.command({ dbStats: 1 });
    const backups = await Backup.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$fileSize" }, count: { $sum: 1 } } },
    ]);
    const exports_ = await DataExport.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$fileSize" }, count: { $sum: 1 } } },
    ]);

    const backupTotal = backups[0]?.total || 0;
    const exportTotal = exports_[0]?.total || 0;

    res.json({
      status: "success",
      data: {
        usage: {
          database: {
            sizeBytes: dbStats.dataSize || 0,
            storageSizeBytes: dbStats.storageSize || 0,
            collections: dbStats.collections || 0,
            objects: dbStats.objects || 0,
          },
          backups: {
            sizeBytes: backupTotal,
            count: backups[0]?.count || 0,
          },
          exports: {
            sizeBytes: exportTotal,
            count: exports_[0]?.count || 0,
          },
          totalSizeBytes: (dbStats.storageSize || 0) + backupTotal + exportTotal,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── DATA EXPORTS ────────────────────────────────────────────────────────────

const MODEL_MAP = {
  users: () => import("../models/user.model.js").then((m) => m.default),
  events: () => import("../models/event.model.js").then((m) => m.default),
  vendors: () => import("../models/vendor.model.js").then((m) => m.default),
  payments: () => import("../models/payment.model.js").then((m) => m.default),
};

const EXPORT_FIELDS = {
  users: ["_id", "email", "firstName", "lastName", "role", "isActive", "createdAt"],
  events: ["_id", "title", "type", "status", "startDate", "endDate", "createdAt"],
  vendors: ["_id", "businessName", "email", "category", "isVerified", "createdAt"],
  payments: ["_id", "amount", "currency", "status", "type", "createdAt"],
};

export const getDataExports = async (req, res, next) => {
  try {
    const exports_ = await DataExport.find({ createdBy: req.admin._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ status: "success", data: { exports: exports_ } });
  } catch (error) {
    next(error);
  }
};

export const createDataExport = async (req, res, next) => {
  try {
    const { name, type, format, filters } = req.body;
    if (!name || !type || !format) return next(createError(400, "Name, type and format are required"));
    if (!MODEL_MAP[type] && type !== "full") return next(createError(400, `Unsupported export type: ${type}`));
    if (!["json", "csv"].includes(format)) return next(createError(400, "format must be json or csv"));
    if (type === "full" && format !== "json") {
      return next(createError(400, "Full exports require JSON format"));
    }

    const export_ = await DataExport.create({
      name,
      type,
      format,
      filters,
      status: "processing",
      createdBy: req.admin._id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h download window
    });

    setImmediate(async () => {
      try {
        let content = "";
        let rowCount = 0;

        const processModel = async (modelType) => {
          const Model = await MODEL_MAP[modelType]();
          const query = {};
          if (filters?.startDate || filters?.endDate) {
            query.createdAt = {};
            if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
            if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
          }
          const docs = await Model.find(query).limit(100000).lean();
          return { docs, fields: EXPORT_FIELDS[modelType] || Object.keys(docs[0] || {}) };
        };

        if (type === "full") {
          const sections = {};
          for (const [modelType] of Object.entries(MODEL_MAP)) {
            const { docs, fields } = await processModel(modelType);
            sections[modelType] = docs.map((d) => Object.fromEntries(fields.map((f) => [f, d[f]])));
            rowCount += docs.length;
          }
          content = JSON.stringify(sections, null, 2);
        } else {
          const { docs, fields } = await processModel(type);
          rowCount = docs.length;
          const mapped = docs.map((d) => Object.fromEntries(fields.map((f) => [f, d[f]])));
          content = format === "json" ? JSON.stringify(mapped, null, 2) : generateCsv(mapped, fields);
        }

        const token = crypto.randomBytes(16).toString("hex");
        const filename = `export-${export_._id}.${format}`;
        const filePath = path.join(EXPORT_DIR, filename);
        fs.writeFileSync(filePath, content, "utf8");

        await DataExport.findByIdAndUpdate(export_._id, {
          status: "completed",
          filePath,
          fileSize: Buffer.byteLength(content),
          rowCount,
          downloadToken: token,
          completedAt: new Date(),
        });

        logger.info(`Data export completed: ${export_._id} (${rowCount} rows)`);
      } catch (err) {
        await DataExport.findByIdAndUpdate(export_._id, {
          status: "failed",
          error: err.message,
        });
        logger.error(`Data export failed: ${export_._id} — ${err.message}`);
      }
    });

    res.status(202).json({
      status: "success",
      message: "Export started",
      data: { export: export_ },
    });
  } catch (error) {
    next(error);
  }
};

export const downloadDataExport = async (req, res, next) => {
  try {
    const export_ = await DataExport.findById(req.params.exportId);
    if (!export_) return next(createError(404, "Export not found"));
    if (export_.status !== "completed") return next(createError(400, "Export is not ready for download"));
    if (export_.expiresAt && export_.expiresAt < new Date()) {
      return next(createError(410, "Export link has expired"));
    }
    if (!export_.filePath || !fs.existsSync(export_.filePath)) {
      return next(createError(404, "Export file not found on disk"));
    }

    const filename = `${export_.name}-${export_._id}.${export_.format}`;
    const contentType = export_.format === "json" ? "application/json" : "text/csv";
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", contentType);
    fs.createReadStream(export_.filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

export const deleteDataExport = async (req, res, next) => {
  try {
    const export_ = await DataExport.findById(req.params.exportId);
    if (!export_) return next(createError(404, "Export not found"));
    if (export_.filePath && fs.existsSync(export_.filePath)) {
      fs.unlinkSync(export_.filePath);
    }
    await export_.deleteOne();
    res.json({ status: "success", message: "Export deleted" });
  } catch (error) {
    next(error);
  }
};

// ─── DATA IMPORTS ────────────────────────────────────────────────────────────

export const getDataImports = async (req, res, next) => {
  try {
    const imports = await DataImport.find({ createdBy: req.admin._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ status: "success", data: { imports } });
  } catch (error) {
    next(error);
  }
};

export const uploadDataImport = async (req, res, next) => {
  try {
    if (!req.file) return next(createError(400, "No file uploaded"));
    const { type, format } = req.body;
    if (!type || !format) return next(createError(400, "type and format are required"));
    if (!MODEL_MAP[type]) return next(createError(400, `Unsupported import type: ${type}`));

    const import_ = await DataImport.create({
      originalFileName: req.file.originalname,
      type,
      format,
      status: "processing",
      filePath: req.file.path,
      createdBy: req.admin._id,
    });

    setImmediate(async () => {
      let successRows = 0;
      let failedRows = 0;
      const errors = [];

      try {
        let records = [];

        if (format === "json") {
          records = JSON.parse(fs.readFileSync(req.file.path, "utf8"));
          if (!Array.isArray(records)) records = [records];
        } else {
          // csv-parser handles quoted fields, embedded commas and CRLF line endings
          records = await new Promise((resolve, reject) => {
            const rows = [];
            fs.createReadStream(req.file.path)
              .pipe(csvParser({ mapHeaders: ({ header }) => header.trim(), mapValues: ({ value }) => value.trim() }))
              .on("data", (row) => rows.push(row))
              .on("end", () => resolve(rows))
              .on("error", reject);
          });
        }

        const total = records.length;
        await DataImport.findByIdAndUpdate(import_._id, { totalRows: total });

        const Model = await MODEL_MAP[type]();

        for (let i = 0; i < records.length; i++) {
          try {
            const { _id, __v, ...data } = records[i];
            await Model.create(data);
            successRows++;
          } catch (err) {
            failedRows++;
            errors.push({ row: i + 2, message: err.message });
          }
        }

        const finalStatus = failedRows === 0 ? "completed" : successRows === 0 ? "failed" : "partial";
        await DataImport.findByIdAndUpdate(import_._id, {
          status: finalStatus,
          processedRows: records.length,
          successRows,
          failedRows,
          errors: errors.slice(0, 100),
          completedAt: new Date(),
        });

        logger.info(`Import ${import_._id}: ${successRows} succeeded, ${failedRows} failed`);
      } catch (err) {
        await DataImport.findByIdAndUpdate(import_._id, {
          status: "failed",
          error: err.message,
          completedAt: new Date(),
        });
        logger.error(`Import failed: ${import_._id} — ${err.message}`);
      }
    });

    res.status(202).json({
      status: "success",
      message: "Import started",
      data: { import: import_ },
    });
  } catch (error) {
    next(error);
  }
};

export const getDataImportStatus = async (req, res, next) => {
  try {
    const import_ = await DataImport.findById(req.params.importId).lean();
    if (!import_) return next(createError(404, "Import not found"));
    res.json({ status: "success", data: { import: import_ } });
  } catch (error) {
    next(error);
  }
};

// ─── RETENTION POLICIES ──────────────────────────────────────────────────────

export const getRetentionPolicies = async (req, res, next) => {
  try {
    const policies = await DataRetentionPolicy.find().sort({ dataType: 1 }).lean();
    res.json({ status: "success", data: { policies } });
  } catch (error) {
    next(error);
  }
};

export const createRetentionPolicy = async (req, res, next) => {
  try {
    const { name, dataType, retentionPeriod, description, autoDelete, archiveBeforeDelete, legalBasis, exceptions } = req.body;
    if (!name || !dataType || !retentionPeriod) {
      return next(createError(400, "name, dataType and retentionPeriod are required"));
    }

    const policy = await DataRetentionPolicy.create({
      name,
      dataType,
      retentionPeriod,
      description,
      autoDelete: autoDelete ?? false,
      archiveBeforeDelete: archiveBeforeDelete ?? true,
      legalBasis,
      exceptions,
      createdBy: req.admin._id,
    });

    res.status(201).json({ status: "success", message: "Retention policy created", data: { policy } });
  } catch (error) {
    next(error);
  }
};

export const updateRetentionPolicy = async (req, res, next) => {
  try {
    const policy = await DataRetentionPolicy.findById(req.params.policyId);
    if (!policy) return next(createError(404, "Retention policy not found"));

    const fields = ["name", "retentionPeriod", "description", "autoDelete", "archiveBeforeDelete", "legalBasis", "exceptions", "isActive"];
    for (const f of fields) {
      if (req.body[f] !== undefined) policy[f] = req.body[f];
    }
    policy.lastModifiedBy = req.admin._id;
    await policy.save();

    res.json({ status: "success", message: "Retention policy updated", data: { policy } });
  } catch (error) {
    next(error);
  }
};

export const deleteRetentionPolicy = async (req, res, next) => {
  try {
    const policy = await DataRetentionPolicy.findByIdAndDelete(req.params.policyId);
    if (!policy) return next(createError(404, "Retention policy not found"));
    res.json({ status: "success", message: "Retention policy deleted" });
  } catch (error) {
    next(error);
  }
};

// ─── CLEANUP ─────────────────────────────────────────────────────────────────

export const cleanupOldBackups = async (req, res, next) => {
  try {
    // Only backups produced by a schedule are subject to that schedule's retention;
    // manual backups are kept until deleted explicitly.
    const schedules = await BackupSchedule.find().lean();
    let deletedCount = 0;
    for (const schedule of schedules) {
      deletedCount += await cleanupScheduleBackups(schedule);
    }
    const safetySnapshotsDeleted = await cleanupSafetyBackups();

    // Also clean up expired exports
    const expiredExports = await DataExport.find({
      expiresAt: { $lt: new Date() },
      status: "completed",
    }).lean();

    for (const exp of expiredExports) {
      if (exp.filePath && fs.existsSync(exp.filePath)) fs.unlinkSync(exp.filePath);
      await DataExport.findByIdAndDelete(exp._id);
    }

    logger.info(
      `Cleanup: deleted ${deletedCount} old scheduled backups, ${safetySnapshotsDeleted} safety snapshots, ${expiredExports.length} expired exports`
    );
    res.json({
      status: "success",
      message: "Cleanup completed",
      data: { deletedCount, safetySnapshotsDeleted, expiredExportsDeleted: expiredExports.length },
    });
  } catch (error) {
    next(error);
  }
};
