import mongoose from 'mongoose';
import logger from '../logger.service.js';
import metricsService from '../monitoring/metrics.service.js';

class DatabaseOptimizationManager {
  constructor() {
    this.optimizationQueue = [];
    this.isOptimizing = false;
    this.optimizationStats = new Map();
  }

  async scheduleOptimization(collection, type) {
    this.optimizationQueue.push({
      collection,
      type,
      timestamp: Date.now()
    });

    if (!this.isOptimizing) {
      await this.processOptimizationQueue();
    }
  }

  async processOptimizationQueue() {
    if (this.isOptimizing || this.optimizationQueue.length === 0) {
      return;
    }

    this.isOptimizing = true;

    try {
      while (this.optimizationQueue.length > 0) {
        const task = this.optimizationQueue.shift();
        await this.optimizeCollection(task);
      }
    } catch (error) {
      logger.error('Error processing optimization queue:', error);
    } finally {
      this.isOptimizing = false;
    }
  }

  async optimizeCollection(task) {
    const startTime = Date.now();
    const stats = {
      startTime,
      type: task.type,
      collection: task.collection,
      improvements: {}
    };

    try {
      switch (task.type) {
        case 'indexes':
          stats.improvements = await this.optimizeIndexes(task.collection);
          break;
        case 'documents':
          stats.improvements = await this.optimizeDocuments(task.collection);
          break;
        case 'queries':
          stats.improvements = await this.optimizeQueries(task.collection);
          break;
      }

      stats.endTime = Date.now();
      stats.duration = stats.endTime - startTime;
      stats.status = 'completed';

      this.optimizationStats.set(`${task.collection}_${task.type}`, stats);
      await this.updateOptimizationMetrics(stats);
    } catch (error) {
      stats.status = 'failed';
      stats.error = error.message;
      logger.error(`Optimization failed for ${task.collection}:`, error);
    }
  }

  async optimizeIndexes(collectionName) {
    const collection = mongoose.connection.db.collection(collectionName);
    const improvements = {
      removedIndexes: 0,
      addedIndexes: 0
    };

    // Analyze index usage
    const indexStats = await collection.aggregate([
      { $indexStats: {} }
    ]).toArray();

    // Remove unused indexes
    for (const stat of indexStats) {
      if (stat.accesses.ops === 0 && !stat.name.includes('_id_')) {
        await collection.dropIndex(stat.name);
        improvements.removedIndexes++;
      }
    }

    // Add suggested indexes based on query patterns
    const queryPatterns = await this.analyzeQueryPatterns(collectionName);
    for (const pattern of queryPatterns) {
      if (pattern.frequency > 100 && !await this.hasIndex(collection, pattern.fields)) {
        await collection.createIndex(
          pattern.fields.reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
        );
        improvements.addedIndexes++;
      }
    }

    return improvements;
  }

  async optimizeDocuments(collectionName) {
    const collection = mongoose.connection.db.collection(collectionName);
    const improvements = {
      compressedDocs: 0,
      removedFields: 0
    };

    // Analyze document structure
    const sampleDocs = await collection.aggregate([
      { $sample: { size: 1000 } }
    ]).toArray();

    const fieldUsage = await this.analyzeFieldUsage(collectionName);
    const unusedFields = Object.entries(fieldUsage)
      .filter(([_, usage]) => usage < 0.01)
      .map(([field]) => field);

    if (unusedFields.length > 0) {
      await collection.updateMany({}, {
        $unset: unusedFields.reduce((acc, field) => ({ ...acc, [field]: "" }), {})
      });
      improvements.removedFields = unusedFields.length;
    }

    return improvements;
  }

  async optimizeQueries(collectionName) {
    const improvements = {
      optimizedQueries: 0
    };

    const queryPatterns = await this.analyzeQueryPatterns(collectionName);
    for (const pattern of queryPatterns) {
      if (pattern.avgDuration > 100) {
        // Suggest query optimization
        this.suggestQueryOptimization(collectionName, pattern);
        improvements.optimizedQueries++;
      }
    }

    return improvements;
  }

  async updateOptimizationMetrics(stats) {
    metricsService.trackDatabaseOptimization({
      collection: stats.collection,
      type: stats.type,
      duration: stats.duration,
      improvements: stats.improvements
    });
  }

  getOptimizationStats() {
    return Array.from(this.optimizationStats.values());
  }
}

export default new DatabaseOptimizationManager(); 