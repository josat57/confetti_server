import Bull from 'bull';
import logger from '../logging/advanced.service.js';
import metricsService from '../monitoring/metrics.service.js';

class QueueManagerService {
  constructor() {
    this.queues = new Map();
    this.processors = new Map();
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0
    };

    this.config = {
      defaultOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: 100,
        removeOnFail: 200
      },
      monitoring: {
        metrics: true,
        events: true
      }
    };

    this.initializeDefaultQueues();
  }

  initializeDefaultQueues() {
    // Email queue
    this.createQueue('email', {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 }
    });

    // File processing queue
    this.createQueue('fileProcessing', {
      attempts: 2,
      timeout: 5 * 60 * 1000 // 5 minutes
    });

    // Notifications queue
    this.createQueue('notifications', {
      attempts: 3,
      timeout: 30 * 1000 // 30 seconds
    });

    // Analytics queue
    this.createQueue('analytics', {
      removeOnComplete: 1000,
      removeOnFail: 2000
    });
  }

  createQueue(name, options = {}) {
    if (this.queues.has(name)) {
      throw new Error(`Queue ${name} already exists`);
    }

    const queue = new Bull(name, {
      redis: process.env.REDIS_URL,
      defaultJobOptions: {
        ...this.config.defaultOptions,
        ...options
      }
    });

    this.setupQueueEvents(queue, name);
    this.queues.set(name, queue);

    logger.info(`Queue ${name} created`);
    return queue;
  }

  registerProcessor(queueName, processor) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    queue.process(async (job) => {
      try {
        const result = await processor(job.data);
        this.stats.processed++;
        return result;
      } catch (error) {
        this.stats.failed++;
        throw error;
      }
    });

    this.processors.set(queueName, processor);
    logger.info(`Processor registered for queue ${queueName}`);
  }

  async addJob(queueName, data, options = {}) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    try {
      const job = await queue.add(data, {
        ...queue.defaultJobOptions,
        ...options
      });

      logger.info(`Job ${job.id} added to queue ${queueName}`);
      return job;
    } catch (error) {
      logger.error(`Failed to add job to queue ${queueName}:`, error);
      throw error;
    }
  }

  setupQueueEvents(queue, name) {
    queue.on('completed', (job) => {
      logger.info(`Job ${job.id} in queue ${name} completed`);
      if (this.config.monitoring.metrics) {
        metricsService.incrementCounter(`queue.${name}.completed`);
      }
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} in queue ${name} failed:`, error);
      if (this.config.monitoring.metrics) {
        metricsService.incrementCounter(`queue.${name}.failed`);
      }
    });

    queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} in queue ${name} stalled`);
      if (this.config.monitoring.metrics) {
        metricsService.incrementCounter(`queue.${name}.stalled`);
      }
    });

    queue.on('error', (error) => {
      logger.error(`Queue ${name} error:`, error);
    });
  }

  async getQueueStats(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [
      jobCounts,
      completedCount,
      failedCount,
      delayedCount,
      activeCount,
      waitingCount
    ] = await Promise.all([
      queue.getJobCounts(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getActiveCount(),
      queue.getWaitingCount()
    ]);

    return {
      name: queueName,
      counts: jobCounts,
      completed: completedCount,
      failed: failedCount,
      delayed: delayedCount,
      active: activeCount,
      waiting: waitingCount
    };
  }

  async getAllQueuesStats() {
    const stats = await Promise.all(
      Array.from(this.queues.keys()).map(name => 
        this.getQueueStats(name)
      )
    );

    return {
      queues: stats,
      total: this.stats,
      processors: Array.from(this.processors.keys())
    };
  }

  async cleanQueue(queueName, status = 'completed') {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    try {
      await queue.clean(1000, status);
      logger.info(`Cleaned ${status} jobs from queue ${queueName}`);
    } catch (error) {
      logger.error(`Failed to clean queue ${queueName}:`, error);
      throw error;
    }
  }

  async pauseQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    try {
      await queue.pause();
      logger.info(`Queue ${queueName} paused`);
    } catch (error) {
      logger.error(`Failed to pause queue ${queueName}:`, error);
      throw error;
    }
  }

  async resumeQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    try {
      await queue.resume();
      logger.info(`Queue ${queueName} resumed`);
    } catch (error) {
      logger.error(`Failed to resume queue ${queueName}:`, error);
      throw error;
    }
  }

  async shutdown() {
    try {
      await Promise.all(
        Array.from(this.queues.values()).map(queue => 
          queue.close()
        )
      );
      logger.info('All queues shut down');
    } catch (error) {
      logger.error('Failed to shut down queues:', error);
      throw error;
    }
  }
}

export default new QueueManagerService(); 