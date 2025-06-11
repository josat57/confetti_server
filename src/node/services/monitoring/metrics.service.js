import prometheus from 'prom-client';
import os from 'os';
import logger from '../logging/advanced.service.js';
import WebSocket, { WebSocketServer } from 'ws';

class MetricsService {
  constructor() {
    this.registry = new prometheus.Registry();
    
    this.config = {
      prefix: 'tripmatch_',
      labels: ['method', 'path', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      gcMetrics: true,
      processMetrics: true,
      intervalSeconds: 10
    };

    this.metrics = {
      http: {
        requestDuration: new prometheus.Histogram({
          name: this.config.prefix + 'http_request_duration_seconds',
          help: 'HTTP request duration in seconds',
          labelNames: this.config.labels,
          buckets: this.config.buckets
        }),
        requestTotal: new prometheus.Counter({
          name: this.config.prefix + 'http_requests_total',
          help: 'Total number of HTTP requests',
          labelNames: this.config.labels
        }),
        requestErrors: new prometheus.Counter({
          name: this.config.prefix + 'http_request_errors_total',
          help: 'Total number of HTTP request errors',
          labelNames: this.config.labels
        })
      },
      database: {
        queryDuration: new prometheus.Histogram({
          name: this.config.prefix + 'db_query_duration_seconds',
          help: 'Database query duration in seconds',
          labelNames: ['operation', 'collection'],
          buckets: this.config.buckets
        }),
        connectionPool: new prometheus.Gauge({
          name: this.config.prefix + 'db_connections_total',
          help: 'Number of active database connections'
        })
      },
      cache: {
        hits: new prometheus.Counter({
          name: this.config.prefix + 'cache_hits_total',
          help: 'Total number of cache hits',
          labelNames: ['type']
        }),
        misses: new prometheus.Counter({
          name: this.config.prefix + 'cache_misses_total',
          help: 'Total number of cache misses',
          labelNames: ['type']
        })
      },
      business: {
        activeUsers: new prometheus.Gauge({
          name: this.config.prefix + 'active_users_total',
          help: 'Number of active users'
        }),
        eventsCreated: new prometheus.Counter({
          name: this.config.prefix + 'events_created_total',
          help: 'Total number of events created'
        })
      },
      system: {
        memory: new prometheus.Gauge({
          name: this.config.prefix + 'memory_usage_bytes',
          help: 'Process memory usage in bytes',
          labelNames: ['type']
        }),
        cpu: new prometheus.Gauge({
          name: this.config.prefix + 'cpu_usage_percent',
          help: 'Process CPU usage percentage'
        })
      }
    };

    this.initialize();
  }

  async initialize() {
    try {
      // Register custom metrics
      Object.values(this.metrics).forEach(category => {
        Object.values(category).forEach(metric => {
          this.registry.registerMetric(metric);
        });
      });

      // Register default metrics if enabled
      if (this.config.processMetrics) {
        prometheus.collectDefaultMetrics({
          prefix: this.config.prefix,
          registry: this.registry
        });
      }

      // Start system metrics collection
      this.startSystemMetricsCollection();

      logger.info('Metrics service initialized successfully');
    } catch (error) {
      logger.error('Metrics service initialization failed:', error);
      throw error;
    }
  }

  observeHttpRequest(method, path, status, duration) {
    const labels = { method, path, status };
    this.metrics.http.requestDuration.observe(labels, duration);
    this.metrics.http.requestTotal.inc(labels);
    
    if (status >= 400) {
      this.metrics.http.requestErrors.inc(labels);
    }
  }

  observeDbQuery(operation, collection, duration) {
    this.metrics.database.queryDuration.observe(
      { operation, collection },
      duration
    );
  }

  setDbConnections(count) {
    this.metrics.database.connectionPool.set(count);
  }

  observeCacheOperation(type, hit) {
    if (hit) {
      this.metrics.cache.hits.inc({ type });
    } else {
      this.metrics.cache.misses.inc({ type });
    }
  }

  setActiveUsers(count) {
    this.metrics.business.activeUsers.set(count);
  }

  incrementEventsCreated() {
    this.metrics.business.eventsCreated.inc();
  }

  startSystemMetricsCollection() {
    setInterval(() => {
      // Memory metrics
      const memory = process.memoryUsage();
      Object.entries(memory).forEach(([type, value]) => {
        this.metrics.system.memory.set({ type }, value);
      });

      // CPU metrics
      const cpuUsage = process.cpuUsage();
      const totalCpuTime = cpuUsage.user + cpuUsage.system;
      const cpuPercent = (totalCpuTime / (os.cpus().length * 1e6)) * 100;
      this.metrics.system.cpu.set(cpuPercent);
    }, this.config.intervalSeconds * 1000);
  }

  async getMetrics() {
    try {
      return await this.registry.metrics();
    } catch (error) {
      logger.error('Metrics collection failed:', error);
      throw error;
    }
  }

  async getMetricValue(name) {
    try {
      const metrics = await this.registry.getMetricsAsJSON();
      return metrics.find(m => m.name === name);
    } catch (error) {
      logger.error(`Metric value retrieval failed for ${name}:`, error);
      throw error;
    }
  }

  resetMetrics() {
    try {
      Object.values(this.metrics).forEach(category => {
        Object.values(category).forEach(metric => {
          if (metric instanceof prometheus.Counter) {
            metric.reset();
          } else if (metric instanceof prometheus.Gauge) {
            metric.set(0);
          }
        });
      });
    } catch (error) {
      logger.error('Metrics reset failed:', error);
      throw error;
    }
  }

  getMetricsConfig() {
    return {
      prefix: this.config.prefix,
      labels: this.config.labels,
      buckets: this.config.buckets,
      gcMetrics: this.config.gcMetrics,
      processMetrics: this.config.processMetrics,
      intervalSeconds: this.config.intervalSeconds
    };
  }

  createCustomMetric(options) {
    try {
      const { type, name, help, labelNames = [], buckets } = options;
      
      let metric;
      switch (type.toLowerCase()) {
        case 'counter':
          metric = new prometheus.Counter({
            name: this.config.prefix + name,
            help,
            labelNames
          });
          break;
        case 'gauge':
          metric = new prometheus.Gauge({
            name: this.config.prefix + name,
            help,
            labelNames
          });
          break;
        case 'histogram':
          metric = new prometheus.Histogram({
            name: this.config.prefix + name,
            help,
            labelNames,
            buckets: buckets || this.config.buckets
          });
          break;
        default:
          throw new Error(`Unsupported metric type: ${type}`);
      }

      this.registry.registerMetric(metric);
      return metric;
    } catch (error) {
      logger.error('Custom metric creation failed:', error);
      throw error;
    }
  }
}

export default new MetricsService(); 