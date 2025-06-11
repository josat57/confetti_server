import os from 'os';
import { EventEmitter } from 'events';
import logger from '../logger.service.js';

class EnhancedMonitoring extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      system: {},
      application: {},
      custom: new Map()
    };
    this.thresholds = {
      cpu: 80, // 80% CPU usage
      memory: 85, // 85% memory usage
      diskSpace: 90 // 90% disk usage
    };
  }

  startMonitoring(interval = 60000) {
    setInterval(() => this.collectMetrics(), interval);
  }

  async collectMetrics() {
    try {
      const systemMetrics = await this.collectSystemMetrics();
      const applicationMetrics = await this.collectApplicationMetrics();

      this.metrics.system = systemMetrics;
      this.metrics.application = applicationMetrics;

      this.checkThresholds();
      this.emit('metrics-collected', this.metrics);
    } catch (error) {
      logger.error('Error collecting metrics:', error);
    }
  }

  async collectSystemMetrics() {
    const cpuUsage = os.loadavg()[0];
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      uptime: os.uptime(),
      platform: os.platform(),
      hostname: os.hostname()
    };
  }

  async collectApplicationMetrics() {
    const { heapUsed, heapTotal } = process.memoryUsage();
    return {
      heapUsage: (heapUsed / heapTotal) * 100,
      uptime: process.uptime(),
      pid: process.pid
    };
  }

  checkThresholds() {
    const { system, application } = this.metrics;

    if (system.cpu > this.thresholds.cpu) {
      this.emit('alert', {
        type: 'cpu',
        message: `High CPU usage: ${system.cpu.toFixed(2)}%`
      });
    }

    if (system.memory > this.thresholds.memory) {
      this.emit('alert', {
        type: 'memory',
        message: `High memory usage: ${system.memory.toFixed(2)}%`
      });
    }

    if (application.heapUsage > this.thresholds.memory) {
      this.emit('alert', {
        type: 'heap',
        message: `High heap usage: ${application.heapUsage.toFixed(2)}%`
      });
    }
  }

  registerCustomMetric(name, collector) {
    this.metrics.custom.set(name, collector);
  }
}

export default new EnhancedMonitoring(); 