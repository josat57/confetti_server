import mongoose from 'mongoose';
import logger from '../logger.service.js';

class DatabaseIndexingService {
  constructor() {
    this.indexStats = new Map();
    this.queryStats = new Map();
    this.indexSuggestions = new Set();
    
    this.thresholds = {
      queryTime: 100, // ms
      indexSize: 10 * 1024 * 1024, // 10MB
      scanThreshold: 1000 // documents
    };
  }

  async analyzeCollections() {
    try {
      const collections = await mongoose.connection.db.collections();

      for (const collection of collections) {
        await this.analyzeCollection(collection);
      }

      return this.generateOptimizationReport();
    } catch (error) {
      logger.error('Collection analysis error:', error);
      throw error;
    }
  }

  async analyzeCollection(collection) {
    try {
      // Get current indexes
      const indexes = await collection.indexes();
      const stats = await collection.stats();
      
      // Analyze index usage
      const indexStats = await mongoose.connection.db.command({
        aggregate: collection.collectionName,
        pipeline: [{ $indexStats: {} }],
        cursor: {}
      });

      this.indexStats.set(collection.collectionName, {
        indexes,
        stats,
        usage: indexStats.cursor.firstBatch
      });

      // Analyze query patterns
      await this.analyzeQueryPatterns(collection);

      // Generate suggestions
      this.generateIndexSuggestions(collection.collectionName);
    } catch (error) {
      logger.error(`Error analyzing collection ${collection.collectionName}:`, error);
    }
  }

  async analyzeQueryPatterns(collection) {
    try {
      const explain = await collection.aggregate([
        { $indexStats: {} },
        {
          $project: {
            key: 1,
            accesses: 1,
            avgQueryTime: { $divide: ['$accesses.duration', '$accesses.ops'] }
          }
        }
      ]).explain('executionStats');

      this.queryStats.set(collection.collectionName, explain.executionStats);
    } catch (error) {
      logger.error(`Error analyzing query patterns for ${collection.collectionName}:`, error);
    }
  }

  private generateIndexSuggestions(collectionName) {
    const stats = this.indexStats.get(collectionName);
    const queryStats = this.queryStats.get(collectionName);

    if (!stats || !queryStats) return;

    // Check for unused indexes
    stats.usage.forEach(usage => {
      if (usage.accesses.ops === 0 && !usage.name.includes('_id_')) {
        this.indexSuggestions.add({
          type: 'remove_index',
          collection: collectionName,
          index: usage.name,
          reason: 'Unused index'
        });
      }
    });

    // Check for slow queries
    if (queryStats.executionStages.stage === 'COLLSCAN' && 
        queryStats.executionStages.nReturned > this.thresholds.scanThreshold) {
      this.indexSuggestions.add({
        type: 'create_index',
        collection: collectionName,
        fields: this.suggestIndexFields(queryStats),
        reason: 'Collection scan detected'
      });
    }
  }

  private suggestIndexFields(queryStats) {
    // Analyze query pattern to suggest appropriate fields for indexing
    const fields = new Set();
    
    if (queryStats.inputStage) {
      this.extractFieldsFromStage(queryStats.inputStage, fields);
    }

    return Array.from(fields);
  }

  private extractFieldsFromStage(stage, fields) {
    if (stage.keyPattern) {
      Object.keys(stage.keyPattern).forEach(field => fields.add(field));
    }

    if (stage.inputStage) {
      this.extractFieldsFromStage(stage.inputStage, fields);
    }
  }

  async applyOptimizations(suggestions) {
    for (const suggestion of suggestions) {
      try {
        const collection = mongoose.connection.db.collection(suggestion.collection);

        if (suggestion.type === 'remove_index') {
          await collection.dropIndex(suggestion.index);
          logger.info(`Dropped index ${suggestion.index} from ${suggestion.collection}`);
        } else if (suggestion.type === 'create_index') {
          const indexSpec = suggestion.fields.reduce((acc, field) => ({
            ...acc,
            [field]: 1
          }), {});
          
          await collection.createIndex(indexSpec, {
            background: true,
            name: `suggested_${suggestion.fields.join('_')}`
          });
          
          logger.info(`Created index on ${suggestion.fields.join(', ')} for ${suggestion.collection}`);
        }
      } catch (error) {
        logger.error(`Error applying optimization for ${suggestion.collection}:`, error);
      }
    }
  }

  generateOptimizationReport() {
    return {
      collections: Array.from(this.indexStats.entries()).map(([name, stats]) => ({
        name,
        indexCount: stats.indexes.length,
        totalSize: stats.stats.size,
        indexSize: stats.stats.totalIndexSize,
        avgQueryTime: this.calculateAverageQueryTime(name)
      })),
      suggestions: Array.from(this.indexSuggestions),
      summary: {
        totalIndexes: this.calculateTotalIndexes(),
        totalSize: this.calculateTotalSize(),
        optimizationCount: this.indexSuggestions.size
      }
    };
  }

  private calculateAverageQueryTime(collectionName) {
    const stats = this.queryStats.get(collectionName);
    return stats ? stats.executionTimeMillis : 0;
  }

  private calculateTotalIndexes() {
    let total = 0;
    for (const stats of this.indexStats.values()) {
      total += stats.indexes.length;
    }
    return total;
  }

  private calculateTotalSize() {
    let total = 0;
    for (const stats of this.indexStats.values()) {
      total += stats.stats.totalIndexSize;
    }
    return total;
  }
}

export default new DatabaseIndexingService(); 