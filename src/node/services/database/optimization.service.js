import mongoose from 'mongoose';
import logger from '../logger.service.js';

class DatabaseOptimizationService {
  constructor() {
    this.indexStats = new Map();
    this.queryStats = new Map();
    this.optimizationSuggestions = new Set();
  }

  async analyzeCollections() {
    try {
      const collections = await mongoose.connection.db.collections();

      for (const collection of collections) {
        // Analyze indexes
        await this.analyzeIndexes(collection);
        
        // Analyze document patterns
        await this.analyzeDocumentPatterns(collection);
        
        // Check for potential optimizations
        await this.checkOptimizationOpportunities(collection);
      }

      logger.info('Database analysis completed');
    } catch (error) {
      logger.error('Error analyzing database:', error);
    }
  }

  async analyzeIndexes(collection) {
    try {
      const indexes = await collection.indexes();
      const stats = await collection.stats();
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

      // Check for unused indexes
      this.checkUnusedIndexes(collection.collectionName);
    } catch (error) {
      logger.error(`Error analyzing indexes for ${collection.collectionName}:`, error);
    }
  }

  async analyzeDocumentPatterns(collection) {
    try {
      const sampleSize = 1000;
      const documents = await collection.find().limit(sampleSize).toArray();
      
      const patterns = this.extractDocumentPatterns(documents);
      this.suggestOptimizations(collection.collectionName, patterns);
    } catch (error) {
      logger.error(`Error analyzing document patterns for ${collection.collectionName}:`, error);
    }
  }

  async checkOptimizationOpportunities(collection) {
    const stats = this.indexStats.get(collection.collectionName);
    
    if (!stats) return;

    // Check for missing indexes on frequently queried fields
    const queryPatterns = this.queryStats.get(collection.collectionName) || [];
    for (const pattern of queryPatterns) {
      if (pattern.frequency > 100 && !this.hasMatchingIndex(stats.indexes, pattern.fields)) {
        this.suggestIndex(collection.collectionName, pattern.fields);
      }
    }

    // Check for document size optimization opportunities
    if (stats.stats.avgObjSize > 16384) { // 16KB
      this.suggestDocumentOptimization(collection.collectionName);
    }
  }

  trackQuery(collection, query, duration) {
    if (!this.queryStats.has(collection)) {
      this.queryStats.set(collection, new Map());
    }

    const queryPattern = this.getQueryPattern(query);
    const stats = this.queryStats.get(collection);
    
    if (stats.has(queryPattern)) {
      const current = stats.get(queryPattern);
      stats.set(queryPattern, {
        frequency: current.frequency + 1,
        avgDuration: (current.avgDuration * current.frequency + duration) / (current.frequency + 1),
        fields: current.fields
      });
    } else {
      stats.set(queryPattern, {
        frequency: 1,
        avgDuration: duration,
        fields: Object.keys(query)
      });
    }
  }

  private checkUnusedIndexes(collectionName) {
    const stats = this.indexStats.get(collectionName);
    
    if (!stats) return;

    for (const index of stats.indexes) {
      const usage = stats.usage.find(u => u.name === index.name);
      
      if (!usage || usage.accesses.ops === 0) {
        this.optimizationSuggestions.add({
          type: 'unused_index',
          collection: collectionName,
          index: index.name,
          suggestion: `Consider removing unused index ${index.name} from ${collectionName}`
        });
      }
    }
  }

  private suggestIndex(collection, fields) {
    this.optimizationSuggestions.add({
      type: 'missing_index',
      collection,
      fields,
      suggestion: `Consider adding index for fields ${fields.join(', ')} in ${collection}`
    });
  }

  private suggestDocumentOptimization(collection) {
    this.optimizationSuggestions.add({
      type: 'document_size',
      collection,
      suggestion: `Consider optimizing document size in ${collection}`
    });
  }

  getOptimizationReport() {
    return {
      suggestions: Array.from(this.optimizationSuggestions),
      indexStats: Object.fromEntries(this.indexStats),
      queryStats: Object.fromEntries(this.queryStats)
    };
  }
}

export default new DatabaseOptimizationService(); 