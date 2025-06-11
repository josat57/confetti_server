import os from 'os';
import cluster from 'cluster';
import { EventEmitter } from 'events';
import logger from '../logger.service.js';
import cacheService from '../cache.service.js';

class AdvancedMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      system: {
        cpu: [],
        memory: [],
        loadAverage: [],
        network: []
      },
      application: {
        requests: new Map(),
        errors: new Map(),
        performance: new Map(),
        activeUsers: new Set()
      },
      database: {
        queries: [],
        connections: 0,
        poolSize: 0
      }
    };

    this.alerts = [];
    this.thresholds = {
      cpu: 80,
      memory: 85,
      errorRate: 5,
      responseTime: 1000
    };
  }

  async startMonitoring() {
    // System monitoring
    setInterval(() => this.monitorSystem(), 5000);
    
    // Application monitoring
    setInterval(() => this.monitorApplication(), 10000);
    
    // Database monitoring
    setInterval(() => this.monitorDatabase(), 15000);
    
    // Cleanup old metrics
    setInterval(() => this.cleanupOldMetrics(), 3600000);

    logger.info('Advanced monitoring started');
  }

  async monitorSystem() {
    try {
      const cpuUsage = await this.getCPUUsage();
      const memoryUsage = this.getMemoryUsage();
      const loadAvg = os.loadavg();
      const networkStats = await this.getNetworkStats();

      this.metrics.system.cpu.push({ timestamp: Date.now(), value: cpuUsage });
      this.metrics.system.memory.push({ timestamp: Date.now(), value: memoryUsage });
      this.metrics.system.loadAverage.push({ timestamp: Date.now(), value: loadAvg[0] });
      this.metrics.system.network.push({ timestamp: Date.now(), ...networkStats });

      this.checkThresholds();
    } catch (error) {
      logger.error('Error monitoring system:', error);
    }
  }

  async monitorApplication() {
    try {
      const requestStats = this.calculateRequestStats();
      const errorStats = this.calculateErrorStats();
      const performanceStats = this.calculatePerformanceStats();

      await cacheService.set('app_metrics', {
        requests: requestStats,
        errors: errorStats,
        performance: performanceStats,
        activeUsers: this.metrics.application.activeUsers.size
      }, 300);

      this.emit('metrics-updated', {
        timestamp: Date.now(),
        metrics: this.metrics
      });
    } catch (error) {
      logger.error('Error monitoring application:', error);
    }
  }

  async monitorDatabase() {
    try {
      const mongoose = await import('mongoose');
      const db = mongoose.connection;

      this.metrics.database.connections = db.connections.length;
      this.metrics.database.poolSize = db.config.poolSize;

      const queryStats = await db.db.admin().serverStatus();
      this.metrics.database.queries.push({
        timestamp: Date.now(),
        operations: queryStats.opcounters
      });

      if (this.metrics.database.queries.length > 100) {
        this.metrics.database.queries.shift();
      }
    } catch (error) {
      logger.error('Error monitoring database:', error);
    }
  }

  trackRequest(req, res, duration) {
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    
    if (!this.metrics.application.requests.has(endpoint)) {
      this.metrics.application.requests.set(endpoint, {
        count: 0,
        totalDuration: 0,
        errors: 0
      });
    }

    const stats = this.metrics.application.requests.get(endpoint);
    stats.count++;
    stats.totalDuration += duration;

    if (res.statusCode >= 400) {
      stats.errors++;
    }
  }

  private async getCPUUsage() {
    const cpus = os.cpus();
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce((acc, cpu) => 
      acc + Object.values(cpu.times).reduce((a, b) => a + b), 0
    );
    return ((totalTick - totalIdle) / totalTick) * 100;
  }

  private getMemoryUsage() {
    const used = process.memoryUsage();
    return (used.heapUsed / used.heapTotal) * 100;
  }

  private async getNetworkStats() {
    const networkInterfaces = os.networkInterfaces();
    return Object.values(networkInterfaces).reduce((acc, interfaces) => {
      interfaces.forEach(interface => {
        if (!interface.internal) {
          acc.bytesReceived = (acc.bytesReceived || 0) + interface.bytesReceived;
          acc.bytesSent = (acc.bytesSent || 0) + interface.bytesSent;
        }
      });
      return acc;
    }, {});
  }

  private checkThresholds() {
    const currentCPU = this.metrics.system.cpu[this.metrics.system.cpu.length - 1].value;
    const currentMemory = this.metrics.system.memory[this.metrics.system.memory.length - 1].value;

    if (currentCPU > this.thresholds.cpu) {
      this.createAlert('CPU Usage', `High CPU usage detected: ${currentCPU.toFixed(2)}%`);
    }

    if (currentMemory > this.thresholds.memory) {
      this.createAlert('Memory Usage', `High memory usage detected: ${currentMemory.toFixed(2)}%`);
    }
  }

  private createAlert(type, message) {
    const alert = {
      type,
      message,
      timestamp: Date.now(),
      id: crypto.randomUUID()
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }

  async getMetricsReport() {
    return {
      system: {
        cpu: this.calculateAverageMetric(this.metrics.system.cpu),
        memory: this.calculateAverageMetric(this.metrics.system.memory),
        loadAverage: this.calculateAverageMetric(this.metrics.system.loadAverage),
        network: this.metrics.system.network[this.metrics.system.network.length - 1]
      },
      application: {
        requests: Object.fromEntries(this.metrics.application.requests),
        activeUsers: this.metrics.application.activeUsers.size,
        errorRate: this.calculateErrorRate()
      },
      database: {
        connections: this.metrics.database.connections,
        poolSize: this.metrics.database.poolSize,
        queryStats: this.metrics.database.queries[this.metrics.database.queries.length - 1]
      },
      alerts: this.alerts.slice(-10)
    };
  }
}

export default new AdvancedMonitoringService(); 