import fs from "fs";
import path from "path";
import { once } from "events";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import DataRetentionPolicy from "../models/dataRetentionPolicy.model.js";
import { logger } from "../utils/logger.js";

const { EJSON } = mongoose.mongo.BSON;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ARCHIVE_DIR = path.join(__dirname, "../../../data/archives");
const EXPORT_DIR = path.join(__dirname, "../../../data/exports");
const IMPORT_DIR = path.join(__dirname, "../../../data/imports");

const BATCH_SIZE = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

// Operators that execute JavaScript on the server are never allowed in exception conditions
const FORBIDDEN_OPERATORS = new Set(["$where", "$function", "$accumulator", "$expr"]);

const model = async (file) => (await import(`../models/${file}`)).default;

export const computeCutoff = (period, from = new Date()) => {
  const d = new Date(from);
  const value = Number(period?.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Retention period must be a positive number");
  }
  switch (period.unit) {
    case "days":
      d.setDate(d.getDate() - value);
      break;
    case "months":
      d.setMonth(d.getMonth() - value);
      break;
    case "years":
      d.setFullYear(d.getFullYear() - value);
      break;
    default:
      throw new Error(`Unsupported retention unit: ${period.unit}`);
  }
  return d;
};

const assertSafeFilter = (value) => {
  if (Array.isArray(value)) return value.forEach(assertSafeFilter);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_OPERATORS.has(k)) throw new Error(`Operator ${k} is not allowed`);
      assertSafeFilter(v);
    }
  }
};

/**
 * Policy exceptions: `condition` is a JSON Mongo filter (e.g. {"status":"disputed"}).
 * Matching records are kept for `extendedPeriod` instead of the normal period.
 * Returns { filterFor(dateField), warnings }.
 */
const buildExceptionFilter = (policy, cutoff) => {
  const warnings = [];
  const exceptions = [];
  for (const ex of policy.exceptions || []) {
    if (!ex?.condition) continue;
    let condition;
    try {
      condition = JSON.parse(ex.condition);
      if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
        throw new Error("condition must be a JSON object");
      }
      assertSafeFilter(condition);
    } catch (e) {
      warnings.push(`Exception "${ex.condition}" ignored: ${e.message}`);
      continue;
    }
    let extendedCutoff = null; // null = keep forever
    if (ex.extendedPeriod?.value) {
      try {
        extendedCutoff = computeCutoff(ex.extendedPeriod);
      } catch (e) {
        warnings.push(`Exception "${ex.condition}" has invalid extendedPeriod, records kept: ${e.message}`);
      }
    }
    exceptions.push({ condition, extendedCutoff });
  }

  const filterFor = (dateField) => {
    const base = { [dateField]: { $lt: cutoff } };
    if (!exceptions.length) return base;
    const or = [{ ...base, $nor: exceptions.map((e) => e.condition) }];
    for (const e of exceptions) {
      if (e.extendedCutoff) or.push({ $and: [e.condition, { [dateField]: { $lt: e.extendedCutoff } }] });
    }
    return { $or: or };
  };
  return { filterFor, warnings };
};

class ArchiveWriter {
  constructor(policy) {
    this.policy = policy;
    this.stream = null;
    this.count = 0;
    this.filePath = null;
  }

  async write(collection, doc) {
    if (!this.stream) {
      if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      this.filePath = path.join(ARCHIVE_DIR, `retention-${this.policy.dataType}-${this.policy._id}-${stamp}.ndjson`);
      this.stream = fs.createWriteStream(this.filePath, { encoding: "utf8" });
    }
    const line = EJSON.stringify({ c: collection, d: doc }, { relaxed: false }) + "\n";
    if (!this.stream.write(line)) await once(this.stream, "drain");
    this.count++;
  }

  async close() {
    if (!this.stream) return;
    this.stream.end();
    await once(this.stream, "finish");
  }
}

/**
 * Walk the matching documents of a raw collection in batches: archive (if
 * requested) and then apply `action` ("delete" or a custom async handler).
 */
const processCollection = async ({ collection, filter, archive, dryRun, onBatch }) => {
  const col = mongoose.connection.db.collection(collection);
  const matched = await col.countDocuments(filter);
  if (dryRun || matched === 0) return { collection, matched, processed: 0 };

  let processed = 0;
  // Re-query each round: processed documents no longer match (deleted/anonymised)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await col.find(filter).limit(BATCH_SIZE).toArray();
    if (!batch.length) break;
    if (archive) for (const doc of batch) await archive.write(collection, doc);
    const ids = batch.map((d) => d._id);
    const n = onBatch ? await onBatch(col, ids, batch) : (await col.deleteMany({ _id: { $in: ids } })).deletedCount;
    processed += n;
    // Stop if nothing changed (would otherwise re-select the same batch forever)
    if (batch.length < BATCH_SIZE || n === 0) break;
  }
  return { collection, matched, processed };
};

const collectionOf = (Model) => Model.collection.collectionName;

/** Remove files older than cutoff in a directory; returns names removed/eligible. */
const sweepDirectory = async (dir, cutoff, keep, dryRun) => {
  if (!fs.existsSync(dir)) return [];
  const removed = [];
  for (const name of await fs.promises.readdir(dir)) {
    const full = path.join(dir, name);
    if (keep.has(full)) continue;
    const stat = await fs.promises.stat(full).catch(() => null);
    if (!stat?.isFile() || stat.mtime >= cutoff) continue;
    if (!dryRun) await fs.promises.unlink(full).catch(() => {});
    removed.push(name);
  }
  return removed;
};

/**
 * Per data type: which records are "expired" and what happens to them.
 * Each handler returns an array of { collection, matched, processed } results.
 */
const HANDLERS = {
  audit_logs: async (ctx) => [
    await processCollection({ ...ctx, collection: collectionOf(await model("auditLog.model.js")), filter: ctx.filterFor("createdAt") }),
  ],

  notifications: async (ctx) => [
    await processCollection({ ...ctx, collection: collectionOf(await model("notification.model.js")), filter: ctx.filterFor("createdAt") }),
  ],

  messages: async (ctx) => [
    await processCollection({ ...ctx, collection: collectionOf(await model("message.model.js")), filter: ctx.filterFor("createdAt") }),
  ],

  analytics: async (ctx) => {
    const results = [];
    for (const file of ["analytics.model.js", "searchHistory.model.js", "systemMetric.model.js"]) {
      results.push(await processCollection({ ...ctx, collection: collectionOf(await model(file)), filter: ctx.filterFor("createdAt") }));
    }
    return results;
  },

  session_data: async (ctx) => {
    const results = [
      await processCollection({ ...ctx, collection: collectionOf(await model("refreshToken.model.js")), filter: ctx.filterFor("createdAt") }),
    ];
    // express-session store (connect-mongo) — sessions expired before the cutoff
    const names = (await mongoose.connection.db.listCollections({ name: "sessions" }).toArray()).map((c) => c.name);
    if (names.length) {
      results.push(await processCollection({ ...ctx, archive: null, collection: "sessions", filter: { expires: { $lt: ctx.cutoff } } }));
    }
    return results;
  },

  // Only settled payments; pending payments are never removed
  payment_records: async (ctx) => [
    await processCollection({
      ...ctx,
      collection: collectionOf(await model("payment.model.js")),
      filter: { $and: [ctx.filterFor("createdAt"), { status: { $in: ["completed", "failed", "refunded"] } }] },
    }),
  ],

  // Finished events (ended before the cutoff) together with records that reference them
  event_data: async (ctx) => {
    const Event = await model("event.model.js");
    const filter = {
      $and: [ctx.filterFor("endDate"), { status: { $in: ["completed", "cancelled"] } }],
    };
    const dependents = Object.values(mongoose.models).filter((M) => {
      const p = M.schema.path("event");
      return M !== Event && p?.options?.ref === "Event";
    });
    const depResults = new Map(dependents.map((M) => [collectionOf(M), { collection: collectionOf(M), matched: 0, processed: 0 }]));

    const eventResult = await processCollection({
      ...ctx,
      collection: collectionOf(Event),
      filter,
      onBatch: async (col, ids) => {
        for (const M of dependents) {
          const r = await processCollection({ ...ctx, collection: collectionOf(M), filter: { event: { $in: ids } } });
          const agg = depResults.get(collectionOf(M));
          agg.matched += r.matched;
          agg.processed += r.processed;
        }
        return (await col.deleteMany({ _id: { $in: ids } })).deletedCount;
      },
    });
    if (ctx.dryRun && eventResult.matched) {
      // Count dependents that would go with the events
      const ids = (await mongoose.connection.db.collection(collectionOf(Event)).find(filter).project({ _id: 1 }).toArray()).map((d) => d._id);
      for (const M of dependents) {
        depResults.get(collectionOf(M)).matched = await M.collection.countDocuments({ event: { $in: ids } });
      }
    }
    return [eventResult, ...depResults.values()];
  },

  // Inactive non-admin accounts are anonymised (not hard-deleted), matching the
  // admin "delete user" behaviour; users with an active subscription are kept.
  user_data: async (ctx) => {
    const User = await model("user.model.js");
    const Subscription = await model("subscription.model.js");
    const RefreshToken = await model("refreshToken.model.js");
    const activeSubscribers = await Subscription.distinct("user", { status: { $in: ["active", "trial"] } });
    const filter = {
      $and: [
        {
          $or: [
            // last activity before the cutoff…
            ctx.filterFor("lastLogin"),
            // …or never logged in and registered before the cutoff
            { $and: [{ lastLogin: { $in: [null] } }, ctx.filterFor("createdAt")] },
          ],
        },
        { role: { $ne: "admin" } },
        { status: { $ne: "deleted" } },
        { _id: { $nin: activeSubscribers } },
      ],
    };
    return [
      await processCollection({
        ...ctx,
        collection: collectionOf(User),
        filter,
        onBatch: async (col, ids) => {
          const now = new Date();
          let n = 0;
          for (const id of ids) {
            const r = await col.updateOne(
              { _id: id },
              {
                $set: {
                  status: "deleted",
                  isActive: false,
                  email: `deleted_${id}@deleted.com`,
                  firstName: "Deleted",
                  lastName: "User",
                  anonymizedAt: now,
                },
                $unset: { phone: "", address: "", paymentMethods: "", profilePicture: "", avatar: "" },
              }
            );
            n += r.modifiedCount;
          }
          await RefreshToken.deleteMany({ user: { $in: ids } });
          return n;
        },
      }),
    ];
  },

  // Backup records + files. The newest completed backup is always kept.
  backups: async (ctx) => {
    const Backup = await model("Backup.model.js");
    const { deleteBackupFiles } = await import("./backup.service.js");
    const latest = await Backup.findOne({ status: "completed" }).sort({ createdAt: -1 }).select("_id").lean();
    const filter = {
      $and: [ctx.filterFor("createdAt"), { status: { $in: ["completed", "failed"] } }, ...(latest ? [{ _id: { $ne: latest._id } }] : [])],
    };
    return [
      await processCollection({
        ...ctx,
        collection: collectionOf(Backup),
        filter,
        onBatch: async (col, ids, docs) => {
          for (const d of docs) await deleteBackupFiles(d);
          return (await col.deleteMany({ _id: { $in: ids } })).deletedCount;
        },
      }),
    ];
  },

  // Export/import records with their files, plus stray files in those folders
  temporary_files: async (ctx) => {
    const DataExport = await model("DataExport.model.js");
    const DataImport = await model("DataImport.model.js");
    const removeFiles = async (col, ids, docs) => {
      for (const d of docs) {
        if (d.filePath) await fs.promises.unlink(d.filePath).catch(() => {});
      }
      return (await col.deleteMany({ _id: { $in: ids } })).deletedCount;
    };
    const notRunning = { status: { $nin: ["processing", "pending"] } };
    const results = [
      await processCollection({ ...ctx, collection: collectionOf(DataExport), filter: { $and: [ctx.filterFor("createdAt"), notRunning] }, onBatch: removeFiles }),
      await processCollection({ ...ctx, collection: collectionOf(DataImport), filter: { $and: [ctx.filterFor("createdAt"), notRunning] }, onBatch: removeFiles }),
    ];
    // Files still referenced by in-progress/unexpired records are kept
    const keep = new Set(
      [
        ...(await DataExport.find({ filePath: { $exists: true } }).select("filePath").lean()),
        ...(await DataImport.find({ filePath: { $exists: true } }).select("filePath").lean()),
      ].map((d) => d.filePath)
    );
    const stray = [
      ...(await sweepDirectory(EXPORT_DIR, ctx.cutoff, keep, ctx.dryRun)),
      ...(await sweepDirectory(IMPORT_DIR, ctx.cutoff, keep, ctx.dryRun)),
    ];
    results.push({ collection: "files", matched: stray.length, processed: ctx.dryRun ? 0 : stray.length });
    return results;
  },
};

export const SUPPORTED_DATA_TYPES = Object.keys(HANDLERS);

/**
 * Apply a retention policy.
 *  - autoDelete=false (or dryRun) → identify only: nothing is changed, counts are reported.
 *  - autoDelete=true → expired records are archived (if archiveBeforeDelete) and removed
 *    (user accounts are anonymised instead of removed).
 */
export const applyRetentionPolicy = async (policyOrId, { dryRun } = {}) => {
  const policy =
    policyOrId instanceof DataRetentionPolicy ? policyOrId : await DataRetentionPolicy.findById(policyOrId);
  if (!policy) {
    const e = new Error("Data retention policy not found");
    e.statusCode = 404;
    throw e;
  }
  const handler = HANDLERS[policy.dataType];
  if (!handler) {
    const e = new Error(`Unsupported data type: ${policy.dataType}`);
    e.statusCode = 400;
    throw e;
  }

  const cutoff = computeCutoff(policy.retentionPeriod);
  const { filterFor, warnings } = buildExceptionFilter(policy, cutoff);
  const identifyOnly = dryRun ?? !policy.autoDelete;
  const archive = !identifyOnly && policy.archiveBeforeDelete ? new ArchiveWriter(policy) : null;

  let targets;
  try {
    targets = await handler({ cutoff, filterFor, dryRun: identifyOnly, archive });
  } finally {
    if (archive) await archive.close();
  }

  const matched = targets.reduce((s, t) => s + t.matched, 0);
  const processed = targets.reduce((s, t) => s + t.processed, 0);
  const anonymized = policy.dataType === "user_data" ? processed : 0;

  if (!identifyOnly) {
    policy.lastApplied = new Date();
    policy.recordsAffected = processed;
    await policy.save();
  }

  const result = {
    policyId: policy._id,
    dataType: policy.dataType,
    cutoffDate: cutoff,
    mode: identifyOnly ? "identify_only" : "enforced",
    recordsAffected: identifyOnly ? matched : processed,
    eligibleRecords: matched,
    archived: archive?.count || 0,
    deleted: identifyOnly ? 0 : processed - anonymized,
    anonymized,
    archiveFile: archive?.filePath || null,
    targets,
    warnings,
  };
  if (identifyOnly && !dryRun) {
    result.note = "Policy has autoDelete disabled: records were identified but not removed.";
  }
  logger.info(
    `Retention policy ${policy._id} (${policy.dataType}) ${result.mode}: ${result.recordsAffected} records`
  );
  return result;
};

let retentionTimer = null;
let retentionRunning = false;

/** Daily enforcement of active policies that have autoDelete enabled. */
export const runAutomaticRetention = async () => {
  if (retentionRunning || mongoose.connection.readyState !== 1) return;
  retentionRunning = true;
  try {
    // Accounts closed by their owners are purged after the promised 30 days
    try {
      const { purgeClosedAccounts } = await import("./account-closure.service.js");
      await purgeClosedAccounts();
    } catch (err) {
      logger.error(`Closed-account purge failed: ${err.message}`);
    }

    const policies = await DataRetentionPolicy.find({ isActive: true, autoDelete: true });
    for (const policy of policies) {
      // Skip if applied in the last 23h (e.g. by another instance or manually)
      if (policy.lastApplied && Date.now() - policy.lastApplied.getTime() < 23 * 60 * 60 * 1000) continue;
      const claimed = await DataRetentionPolicy.findOneAndUpdate(
        { _id: policy._id, lastApplied: policy.lastApplied ?? { $in: [null] } },
        { lastApplied: new Date() },
        { new: true }
      );
      if (!claimed) continue;
      try {
        await applyRetentionPolicy(claimed, { dryRun: false });
      } catch (err) {
        logger.error(`Automatic retention for policy ${policy._id} failed: ${err.message}`);
      }
    }
  } finally {
    retentionRunning = false;
  }
};

export const startRetentionScheduler = (intervalMs = 60 * 60 * 1000) => {
  if (retentionTimer) clearInterval(retentionTimer);
  retentionTimer = setInterval(() => runAutomaticRetention().catch(() => {}), intervalMs);
  retentionTimer.unref?.();
};

export const stopRetentionScheduler = () => {
  if (retentionTimer) clearInterval(retentionTimer);
  retentionTimer = null;
};

export { DAY_MS };
