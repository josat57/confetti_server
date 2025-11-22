import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const execAsync = promisify(exec);

/**
 * Database Backup Script
 * Creates MongoDB backups and uploads to storage
 */

class DatabaseBackup {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || "./backups";
    this.mongoUri = process.env.MONGODB_URI;
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
  }

  /**
   * Create backup directory if it doesn't exist
   */
  async ensureBackupDir() {
    try {
      await fs.access(this.backupDir);
    } catch (error) {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Generate backup filename with timestamp
   */
  getBackupFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `mongodb-backup-${timestamp}`;
  }

  /**
   * Create MongoDB backup using mongodump
   */
  async createBackup() {
    try {
      await this.ensureBackupDir();

      const backupName = this.getBackupFilename();
      const backupPath = path.join(this.backupDir, backupName);

      console.log("Starting MongoDB backup...");
      console.log(`Backup location: ${backupPath}`);

      // Execute mongodump
      const command = `mongodump --uri="${this.mongoUri}" --out="${backupPath}" --gzip`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes("done dumping")) {
        console.error("Backup stderr:", stderr);
      }

      console.log("Backup stdout:", stdout);
      console.log("✅ Backup completed successfully");

      // Get backup size
      const stats = await this.getBackupSize(backupPath);
      console.log(`Backup size: ${this.formatBytes(stats.size)}`);

      return {
        success: true,
        backupName,
        backupPath,
        size: stats.size,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("❌ Backup failed:", error.message);
      throw error;
    }
  }

  /**
   * Get backup directory size
   */
  async getBackupSize(dirPath) {
    let totalSize = 0;

    async function calculateSize(currentPath) {
      const stats = await fs.stat(currentPath);

      if (stats.isDirectory()) {
        const files = await fs.readdir(currentPath);
        for (const file of files) {
          await calculateSize(path.join(currentPath, file));
        }
      } else {
        totalSize += stats.size;
      }
    }

    await calculateSize(dirPath);
    return { size: totalSize };
  }

  /**
   * Format bytes to human-readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups() {
    try {
      console.log("Cleaning up old backups...");

      const files = await fs.readdir(this.backupDir);
      const now = Date.now();
      const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;

      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > retentionMs) {
          await fs.rm(filePath, { recursive: true, force: true });
          console.log(`Deleted old backup: ${file}`);
          deletedCount++;
        }
      }

      console.log(`✅ Cleanup completed. Deleted ${deletedCount} old backups.`);
    } catch (error) {
      console.error("❌ Cleanup failed:", error.message);
    }
  }

  /**
   * List all backups
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          const size = await this.getBackupSize(filePath);
          backups.push({
            name: file,
            path: filePath,
            size: size.size,
            created: stats.mtime,
            age: Math.floor(
              (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24)
            ), // days
          });
        }
      }

      return backups.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error("Failed to list backups:", error.message);
      return [];
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupName) {
    try {
      const backupPath = path.join(this.backupDir, backupName);

      // Check if backup exists
      await fs.access(backupPath);

      console.log(`Starting restore from backup: ${backupName}`);

      // Execute mongorestore
      const command = `mongorestore --uri="${this.mongoUri}" --gzip --drop "${backupPath}"`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes("done")) {
        console.error("Restore stderr:", stderr);
      }

      console.log("Restore stdout:", stdout);
      console.log("✅ Restore completed successfully");

      return {
        success: true,
        backupName,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("❌ Restore failed:", error.message);
      throw error;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const backup = new DatabaseBackup();
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case "create":
          await backup.createBackup();
          await backup.cleanupOldBackups();
          break;

        case "list":
          const backups = await backup.listBackups();
          console.log("\n📦 Available Backups:\n");
          backups.forEach((b, i) => {
            console.log(`${i + 1}. ${b.name}`);
            console.log(`   Size: ${backup.formatBytes(b.size)}`);
            console.log(`   Created: ${b.created.toLocaleString()}`);
            console.log(`   Age: ${b.age} days\n`);
          });
          break;

        case "restore":
          const backupName = process.argv[3];
          if (!backupName) {
            console.error("Please provide backup name to restore");
            process.exit(1);
          }
          await backup.restoreBackup(backupName);
          break;

        case "cleanup":
          await backup.cleanupOldBackups();
          break;

        default:
          console.log("Usage:");
          console.log("  node backup-database.js create   - Create new backup");
          console.log("  node backup-database.js list     - List all backups");
          console.log(
            "  node backup-database.js restore <name> - Restore from backup"
          );
          console.log(
            "  node backup-database.js cleanup  - Clean up old backups"
          );
          process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  })();
}

export default DatabaseBackup;
