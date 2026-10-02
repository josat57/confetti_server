import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import { once } from "events";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Backup from "../models/Backup.model.js";
import BackupSchedule from "../models/BackupSchedule.model.js";
import { logger } from "../utils/logger.js";

const { EJSON } = mongoose.mongo.BSON;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKUP_DIR = path.join(__dirname, "../../../data/backups");

export const BACKUP_FORMAT = "ejson-ndjson";
const FORMAT_VERSION = 1;
const INSERT_BATCH_SIZE = 1000;
const TEMP_PREFIX = "__restore_tmp_";

// Never overwritten by a restore: they track the restore itself.
const RESTORE_PROTECTED_COLLECTIONS = new Set(["backups", "backupschedules"]);

const SAFETY_RETENTION_DAYS = Number(process.env.BACKUP_SAFETY_RETENTION_DAYS) || 14;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const getDb = () => mongoose.connection.db;

let restoreInProgress = false;
let schedulerTimer = null;
let schedulerTickRunning = false;

/**
 * Real collections only (no views, no system collections, no restore leftovers).
 */
export const listBackupableCollections = async (db = getDb()) => {
  const infos = await db.listCollections({}, { nameOnly: false }).toArray();
  return infos.filter(
    (c) =>
      (c.type === undefined || c.type === "collection") &&
      !c.name.startsWith("system.") &&
      !c.name.startsWith(TEMP_PREFIX)
  );
};

const writeLine = async (stream, hash, line) => {
  const data = line + "\n";
  hash.update(data);
  if (!stream.write(data)) await once(stream, "drain");
};

/**
 * Pick the backup an incremental/differential backup is based on.
 * incremental → last completed backup of the chain (any type)
 * differential → last completed full backup
 */
const findBaseBackup = async (type, scheduleId) => {
  const filter = {
    status: { $in: ["completed", "restoring"] },
    format: BACKUP_FORMAT,
    trigger: { $ne: "pre_restore" },
  };
  if (scheduleId) filter.schedule = scheduleId;
  if (type === "differential") filter.type = "full";
  return Backup.findOne(filter).sort({ completedAt: -1 }).lean();
};

/**
 * Perform a backup for an already-created Backup document (status "running").
 * Streams every document as canonical EJSON so ObjectIds, Dates, Decimals,
 * Binary data etc. round-trip exactly. Resolves with the updated backup.
 */
export const runBackup = async (backupId) => {
  const startTime = Date.now();
  const filePath = path.join(BACKUP_DIR, `backup-${backupId}.ndjson`);
  let stream;

  try {
    const backup = await Backup.findById(backupId);
    if (!backup) throw new Error("Backup record not found");

    const db = getDb();
    const available = await listBackupableCollections(db);
    const requested = backup.collections || [];
    const targets = requested.length
      ? available.filter((c) => requested.includes(c.name))
      : available;

    if (requested.length) {
      const missing = requested.filter((n) => !available.some((c) => c.name === n));
      if (missing.length) {
        throw new Error(`Collections not found: ${missing.join(", ")}`);
      }
    }

    let since = null;
    let note;
    let effectiveType = backup.type;
    let baseBackupId;
    if (backup.type === "incremental" || backup.type === "differential") {
      const base = await findBaseBackup(backup.type, backup.schedule);
      if (base) {
        since = base.createdAt; // started-at of base: overlap is safe (upserts)
        baseBackupId = base._id;
      } else {
        effectiveType = "full";
        note = `No base backup found for ${backup.type} backup; a full backup was taken instead`;
      }
    }

    const hash = crypto.createHash("sha256");
    stream = fs.createWriteStream(filePath, { encoding: "utf8" });

    await writeLine(
      stream,
      hash,
      JSON.stringify({
        header: true,
        format: BACKUP_FORMAT,
        version: FORMAT_VERSION,
        backupId: String(backupId),
        type: effectiveType,
        since: since ? since.toISOString() : null,
        createdAt: new Date().toISOString(),
      })
    );

    const collectionStats = [];
    let totalDocs = 0;

    for (const info of targets) {
      const query = since
        ? {
            $or: [
              { updatedAt: { $gte: since } },
              { createdAt: { $gte: since } },
              // Documents without timestamps cannot be diffed; always include them
              { updatedAt: { $exists: false }, createdAt: { $exists: false } },
            ],
          }
        : {};

      // Collection marker line, so empty collections are still restorable
      await writeLine(
        stream,
        hash,
        EJSON.stringify({ collection: info.name, options: info.options || {} }, { relaxed: false })
      );

      let count = 0;
      let sizeBytes = 0;
      const cursor = db.collection(info.name).find(query);
      for await (const doc of cursor) {
        const line = EJSON.stringify({ c: info.name, d: doc }, { relaxed: false });
        sizeBytes += Buffer.byteLength(line);
        await writeLine(stream, hash, line);
        count++;
      }
      collectionStats.push({ name: info.name, count, sizeBytes });
      totalDocs += count;
    }

    stream.end();
    await once(stream, "finish");

    const fileSize = fs.statSync(filePath).size;
    let mongoVersion;
    try {
      mongoVersion = (await db.command({ buildInfo: 1 })).version;
    } catch {
      mongoVersion = undefined;
    }

    const updated = await Backup.findByIdAndUpdate(
      backupId,
      {
        status: "completed",
        type: effectiveType,
        format: BACKUP_FORMAT,
        baseBackup: baseBackupId,
        filePath,
        fileSize,
        checksum: hash.digest("hex"),
        durationMs: Date.now() - startTime,
        completedAt: new Date(),
        $unset: { error: 1 },
        metadata: {
          mongoVersion,
          nodeVersion: process.version,
          totalDocuments: totalDocs,
          since: since || undefined,
          note,
          collectionStats,
        },
      },
      { new: true }
    );

    logger.info(`Backup completed: ${backupId} (${totalDocs} documents)`);
    return updated;
  } catch (err) {
    if (stream && !stream.destroyed) stream.destroy();
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore cleanup failure */
    }
    await Backup.findByIdAndUpdate(backupId, {
      status: "failed",
      error: err.message,
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    logger.error(`Backup failed: ${backupId} — ${err.message}`);
    throw err;
  }
};

/**
 * Create a Backup record and run it. Returns { backup, done } where `done`
 * is the promise of the running job (always settles; never rejects).
 */
export const startBackup = async ({
  name,
  description,
  type = "full",
  databases = [],
  collections = [],
  createdBy,
  trigger = "manual",
  schedule,
  restoreOf,
}) => {
  const backup = await Backup.create({
    name,
    description,
    type,
    databases,
    collections,
    status: "running",
    trigger,
    schedule,
    restoreOf,
    createdBy,
  });

  const done = runBackup(backup._id).then(
    (b) => ({ ok: true, backup: b }),
    (error) => ({ ok: false, error })
  );
  return { backup, done };
};

/**
 * Stream-hash a file (avoids loading large backups into memory).
 */
export const hashFile = async (filePath) => {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
};

export const isRestorable = (backup) => backup.format === BACKUP_FORMAT;

/**
 * Iterate the parsed lines of an EJSON-NDJSON backup file.
 */
async function* readBackupLines(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) {
      first = false;
      const header = JSON.parse(line);
      if (!header.header || header.format !== BACKUP_FORMAT) {
        throw new Error("Unrecognised backup file format");
      }
      yield { header };
      continue;
    }
    yield EJSON.parse(line, { relaxed: false });
  }
}

/**
 * Validate a restore request before doing anything destructive.
 * Returns { backup, collections } or throws an Error with `.statusCode`.
 */
export const prepareRestore = async (backupId, requestedCollections) => {
  const fail = (status, message) => {
    const e = new Error(message);
    e.statusCode = status;
    return e;
  };

  const backup = await Backup.findById(backupId);
  if (!backup) throw fail(404, "Backup not found");
  if (backup.status !== "completed") throw fail(400, "Only completed backups can be restored");
  if (!isRestorable(backup)) {
    throw fail(
      400,
      "This backup was created in the legacy JSON format, which does not preserve ObjectIds or dates and cannot be restored safely. It can still be downloaded for manual inspection."
    );
  }
  if (!backup.filePath || !fs.existsSync(backup.filePath)) {
    throw fail(400, "Backup file not found on disk");
  }
  if (restoreInProgress || (await Backup.exists({ status: "restoring" }))) {
    throw fail(409, "Another restore is already in progress");
  }

  const inBackup = (backup.metadata?.collectionStats || []).map((c) => c.name);
  let collections = inBackup;
  if (requestedCollections !== undefined && requestedCollections !== null) {
    if (!Array.isArray(requestedCollections) || requestedCollections.some((c) => typeof c !== "string")) {
      throw fail(400, "collections must be an array of collection names");
    }
    if (requestedCollections.length) {
      const unknown = requestedCollections.filter((c) => !inBackup.includes(c));
      if (unknown.length) {
        throw fail(400, `Collections not present in this backup: ${unknown.join(", ")}`);
      }
      collections = requestedCollections;
    }
  }
  collections = collections.filter((c) => !RESTORE_PROTECTED_COLLECTIONS.has(c));
  if (!collections.length) throw fail(400, "No restorable collections selected");

  const checksum = await hashFile(backup.filePath);
  if (checksum !== backup.checksum) {
    throw fail(400, "Backup file failed integrity check (checksum mismatch); restore aborted");
  }

  // Atomically claim the backup for restoring
  const claimed = await Backup.findOneAndUpdate(
    { _id: backup._id, status: "completed" },
    { status: "restoring", $unset: { restoreError: 1 } },
    { new: true }
  );
  if (!claimed) throw fail(409, "Backup is no longer available for restore");

  return { backup: claimed, collections };
};

const copyIndexes = async (db, fromName, toName) => {
  let indexes;
  try {
    indexes = await db.collection(fromName).listIndexes().toArray();
  } catch {
    return false; // source collection does not exist
  }
  const specs = indexes
    .filter((ix) => ix.name !== "_id_")
    .map(({ v, ns, ...spec }) => spec);
  if (specs.length) {
    await db.command({ createIndexes: toName, indexes: specs });
  }
  return true;
};

const ensureModelIndexes = async (collectionName) => {
  for (const model of Object.values(mongoose.models)) {
    if (model.collection?.collectionName === collectionName) {
      try {
        await model.createIndexes();
      } catch (e) {
        logger.warn(`Index build for ${collectionName} after restore failed: ${e.message}`);
      }
    }
  }
};

/**
 * Full backup restore: stage every collection into a temp collection, copy the
 * live indexes onto it, and only once *everything* staged successfully swap
 * each temp collection in with an atomic rename. Live data is never touched
 * if staging fails.
 */
const restoreFull = async (db, backup, collections, restoreId) => {
  const tempName = (c) => `${TEMP_PREFIX}${restoreId}_${c}`;
  const wanted = new Set(collections);
  const staged = new Map(); // collection -> options
  const buffers = new Map();

  const flush = async (col) => {
    const batch = buffers.get(col);
    if (!batch?.length) return;
    buffers.set(col, []);
    const opts = { ordered: true };
    if (staged.get(col)?.validator) opts.bypassDocumentValidation = true;
    await db.collection(tempName(col)).insertMany(batch, opts);
  };

  try {
    for await (const entry of readBackupLines(backup.filePath)) {
      if (entry.header) continue;
      if (entry.collection !== undefined) {
        if (!wanted.has(entry.collection)) continue;
        const { collection: col, options = {} } = entry;
        // Keep capped/collation/validator settings of the original collection
        const { uuid, ...createOpts } = options;
        await db.createCollection(tempName(col), createOpts);
        staged.set(col, createOpts);
        buffers.set(col, []);
        continue;
      }
      if (!wanted.has(entry.c)) continue;
      const batch = buffers.get(entry.c);
      batch.push(entry.d);
      if (batch.length >= INSERT_BATCH_SIZE) await flush(entry.c);
    }
    for (const col of staged.keys()) await flush(col);

    const missing = collections.filter((c) => !staged.has(c));
    if (missing.length) throw new Error(`Backup file is missing collections: ${missing.join(", ")}`);

    // Rebuild indexes before swapping so unique-constraint problems abort the restore
    const hadLive = new Map();
    for (const col of collections) {
      hadLive.set(col, await copyIndexes(db, col, tempName(col)));
    }

    const swapped = [];
    try {
      for (const col of collections) {
        await db.renameCollection(tempName(col), col, { dropTarget: true });
        swapped.push(col);
      }
    } catch (swapErr) {
      const e = new Error(
        `Swap failed after restoring [${swapped.join(", ") || "none"}]: ${swapErr.message}`
      );
      e.partial = true;
      throw e;
    }

    for (const col of collections) {
      if (!hadLive.get(col)) await ensureModelIndexes(col);
    }
  } finally {
    // Drop any temp collections left over (only exist if something failed)
    for (const col of staged.keys()) {
      await db.collection(tempName(col)).drop().catch(() => {});
    }
  }
};

/**
 * Incremental/differential restore: the file only holds changed documents, so
 * apply them on top of the live data (replace-or-insert by _id).
 */
const restoreDelta = async (db, backup, collections) => {
  const wanted = new Set(collections);
  const buffers = new Map();

  const flush = async (col) => {
    const batch = buffers.get(col);
    if (!batch?.length) return;
    buffers.set(col, []);
    await db.collection(col).bulkWrite(
      batch.map((doc) => ({
        replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
      })),
      { ordered: false }
    );
  };

  for await (const entry of readBackupLines(backup.filePath)) {
    if (entry.header || entry.collection !== undefined) continue;
    if (!wanted.has(entry.c)) continue;
    if (!buffers.has(entry.c)) buffers.set(entry.c, []);
    const batch = buffers.get(entry.c);
    batch.push(entry.d);
    if (batch.length >= INSERT_BATCH_SIZE) await flush(entry.c);
  }
  for (const col of buffers.keys()) await flush(col);
};

/**
 * Run a restore that `prepareRestore` has validated and claimed. Takes a
 * safety snapshot of the affected collections first; aborts if it fails.
 */
export const runRestore = async (backup, collections, adminId) => {
  restoreInProgress = true;
  const backupId = backup._id;
  let safetyBackupId;

  try {
    // Snapshot the live versions of the affected collections (those that exist)
    const live = new Set((await listBackupableCollections()).map((c) => c.name));
    const toSnapshot = collections.filter((c) => live.has(c));
    if (toSnapshot.length) {
      const { backup: safety, done } = await startBackup({
        name: `Pre-restore snapshot (${backup.name})`,
        description: `Automatic snapshot taken before restoring backup ${backupId}`,
        type: "full",
        collections: toSnapshot,
        createdBy: adminId,
        trigger: "pre_restore",
        restoreOf: backupId,
      });
      const result = await done;
      if (!result.ok) {
        throw new Error(`Pre-restore safety snapshot failed, restore aborted: ${result.error.message}`);
      }
      safetyBackupId = safety._id;
    }

    const db = getDb();
    const restoreId = crypto.randomBytes(4).toString("hex");
    if (backup.type === "incremental" || backup.type === "differential") {
      await restoreDelta(db, backup, collections);
    } else {
      await restoreFull(db, backup, collections, restoreId);
    }

    await Backup.findByIdAndUpdate(backupId, {
      status: "completed",
      lastRestoredAt: new Date(),
      lastRestoredBy: adminId,
      lastSafetyBackup: safetyBackupId,
      $unset: { restoreError: 1 },
    });
    logger.info(`Restore completed from backup ${backupId} (${collections.join(", ")})`);
  } catch (err) {
    const message = safetyBackupId
      ? `${err.message}. Pre-restore snapshot: ${safetyBackupId}`
      : err.message;
    await Backup.findByIdAndUpdate(backupId, {
      status: "completed",
      restoreError: message,
      lastSafetyBackup: safetyBackupId,
    }).catch(() => {});
    logger.error(`Restore from backup ${backupId} failed: ${message}`);
  } finally {
    restoreInProgress = false;
  }
};

// ─── SCHEDULES ───────────────────────────────────────────────────────────────

/**
 * Delete completed backups belonging to a schedule that are older than its
 * retention. Manual backups are never removed automatically.
 */
export const cleanupScheduleBackups = async (schedule) => {
  const cutoff = new Date(Date.now() - (schedule.retentionDays || 30) * 24 * 60 * 60 * 1000);
  const old = await Backup.find({
    schedule: schedule._id,
    status: { $in: ["completed", "failed"] },
    createdAt: { $lt: cutoff },
  }).lean();

  // Never delete the most recent successful backup of a schedule
  const latest = await Backup.findOne({ schedule: schedule._id, status: "completed" })
    .sort({ createdAt: -1 })
    .select("_id")
    .lean();

  let deleted = 0;
  for (const b of old) {
    if (latest && String(latest._id) === String(b._id)) continue;
    await deleteBackupFiles(b);
    await Backup.findByIdAndDelete(b._id);
    deleted++;
  }
  return deleted;
};

export const cleanupSafetyBackups = async () => {
  const cutoff = new Date(Date.now() - SAFETY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const old = await Backup.find({
    trigger: "pre_restore",
    status: { $in: ["completed", "failed"] },
    createdAt: { $lt: cutoff },
  }).lean();
  for (const b of old) {
    await deleteBackupFiles(b);
    await Backup.findByIdAndDelete(b._id);
  }
  return old.length;
};

export const deleteBackupFiles = async (backup) => {
  if (backup.filePath && fs.existsSync(backup.filePath)) {
    await fs.promises.unlink(backup.filePath).catch(() => {});
  }
};

/**
 * Run a schedule's backup and record the outcome on the schedule.
 * Returns { backup, done }.
 */
export const runScheduledBackup = async (schedule, { manual = false } = {}) => {
  const { backup, done } = await startBackup({
    name: manual ? `${schedule.name} (manual run)` : `${schedule.name} (${new Date().toISOString()})`,
    description: manual
      ? `Manual run of schedule: ${schedule.name}`
      : `Scheduled ${schedule.frequency} backup: ${schedule.name}`,
    type: schedule.type,
    databases: schedule.databases,
    collections: schedule.collections,
    createdBy: schedule.createdBy,
    trigger: "scheduled",
    schedule: schedule._id,
  });

  await BackupSchedule.findByIdAndUpdate(schedule._id, {
    lastRun: new Date(),
    lastStatus: "running",
    lastBackup: backup._id,
  });

  const tracked = done.then(async (result) => {
    await BackupSchedule.findByIdAndUpdate(schedule._id, {
      lastStatus: result.ok ? "success" : "failed",
    }).catch(() => {});
    if (result.ok) {
      await cleanupScheduleBackups(schedule).catch((e) =>
        logger.warn(`Backup retention cleanup failed for schedule ${schedule._id}: ${e.message}`)
      );
    }
    return result;
  });

  return { backup, done: tracked };
};

const schedulerTick = async () => {
  if (schedulerTickRunning || mongoose.connection.readyState !== 1) return;
  schedulerTickRunning = true;
  try {
    const now = new Date();
    const due = await BackupSchedule.find({ isEnabled: true, nextRun: { $lte: now } });
    for (const schedule of due) {
      // Atomic claim so multiple server instances don't run the same schedule
      const claimed = await BackupSchedule.findOneAndUpdate(
        { _id: schedule._id, isEnabled: true, nextRun: schedule.nextRun },
        { nextRun: schedule.computeNextRun() },
        { new: true }
      );
      if (!claimed) continue;

      const stillRunning = await Backup.exists({ schedule: schedule._id, status: "running" });
      if (stillRunning) {
        await BackupSchedule.findByIdAndUpdate(schedule._id, { lastStatus: "skipped", lastRun: now });
        continue;
      }

      await runScheduledBackup(claimed);
    }
    await cleanupSafetyBackups();
  } catch (err) {
    logger.error(`Backup scheduler tick failed: ${err.message}`);
  } finally {
    schedulerTickRunning = false;
  }
};

/**
 * Mark jobs left "running"/"restoring" by a crash or restart, then start the
 * schedule poller.
 */
export const startBackupScheduler = async (intervalMs = 60000) => {
  try {
    const stale = await Backup.updateMany(
      { status: "running" },
      { status: "failed", error: "Interrupted by server restart" }
    );
    const staleRestore = await Backup.updateMany(
      { status: "restoring" },
      { status: "completed", restoreError: "Restore interrupted by server restart" }
    );
    await BackupSchedule.updateMany({ lastStatus: "running" }, { lastStatus: "failed" });
    if (stale.modifiedCount || staleRestore.modifiedCount) {
      logger.warn(
        `Backup recovery: ${stale.modifiedCount} interrupted backups, ${staleRestore.modifiedCount} interrupted restores`
      );
    }
    const db = getDb();
    const leftovers = (await db.listCollections({}, { nameOnly: true }).toArray()).filter((c) =>
      c.name.startsWith(TEMP_PREFIX)
    );
    for (const c of leftovers) await db.collection(c.name).drop().catch(() => {});
  } catch (err) {
    logger.error(`Backup recovery on startup failed: ${err.message}`);
  }

  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = setInterval(schedulerTick, intervalMs);
  schedulerTimer.unref?.();
  // Run once shortly after boot to catch schedules that were due while down
  setTimeout(schedulerTick, 5000).unref?.();
};

export const stopBackupScheduler = () => {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
};
