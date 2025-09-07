const Bull = require('bull');
const config = require('../config');
const logger = require('../utils/logger');

// Import job processors
const emailProcessor = require('./processors/emailProcessor');
const contractProcessor = require('./processors/contractProcessor');
const notificationProcessor = require('./processors/notificationProcessor');
const analyticsProcessor = require('./processors/analyticsProcessor');
const cleanupProcessor = require('./processors/cleanupProcessor');
const backupProcessor = require('./processors/backupProcessor');

class JobManager {
  constructor() {
    this.queues = {};
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    const redisConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      }
    };

    // Create queues
    this.queues.email = new Bull('email', redisConfig);
    this.queues.contract = new Bull('contract', redisConfig);
    this.queues.notification = new Bull('notification', redisConfig);
    this.queues.analytics = new Bull('analytics', redisConfig);
    this.queues.cleanup = new Bull('cleanup', redisConfig);
    this.queues.backup = new Bull('backup', redisConfig);

    // Register processors
    this.registerProcessors();

    // Setup recurring jobs
    this.setupRecurringJobs();

    // Setup event handlers
    this.setupEventHandlers();

    this.initialized = true;
    logger.info('Job manager initialized');
  }

  registerProcessors() {
    // Email queue
    this.queues.email.process('send-email', emailProcessor.sendEmail);
    this.queues.email.process('send-bulk-email', emailProcessor.sendBulkEmail);

    // Contract queue
    this.queues.contract.process('check-expiry', contractProcessor.checkExpiry);
    this.queues.contract.process('generate-pdf', contractProcessor.generatePDF);
    this.queues.contract.process('process-signature', contractProcessor.processSignature);
    this.queues.contract.process('archive-contract', contractProcessor.archiveContract);

    // Notification queue
    this.queues.notification.process('send-notification', notificationProcessor.sendNotification);
    this.queues.notification.process('send-push', notificationProcessor.sendPushNotification);

    // Analytics queue
    this.queues.analytics.process('generate-report', analyticsProcessor.generateReport);
    this.queues.analytics.process('calculate-metrics', analyticsProcessor.calculateMetrics);

    // Cleanup queue
    this.queues.cleanup.process('clean-temp-files', cleanupProcessor.cleanTempFiles);
    this.queues.cleanup.process('clean-expired-tokens', cleanupProcessor.cleanExpiredTokens);
    this.queues.cleanup.process('clean-old-logs', cleanupProcessor.cleanOldLogs);

    // Backup queue
    this.queues.backup.process('backup-database', backupProcessor.backupDatabase);
    this.queues.backup.process('backup-files', backupProcessor.backupFiles);
  }

  setupRecurringJobs() {
    // Contract expiry check - daily at 9 AM
    this.queues.contract.add(
      'check-expiry',
      {},
      {
        repeat: { cron: '0 9 * * *' },
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    // Cleanup jobs - daily at 2 AM
    this.queues.cleanup.add(
      'clean-temp-files',
      {},
      {
        repeat: { cron: '0 2 * * *' },
        removeOnComplete: true
      }
    );

    this.queues.cleanup.add(
      'clean-expired-tokens',
      {},
      {
        repeat: { cron: '0 3 * * *' },
        removeOnComplete: true
      }
    );

    // Analytics - weekly on Sunday
    if (config.app.features.analytics) {
      this.queues.analytics.add(
        'calculate-metrics',
        { type: 'weekly' },
        {
          repeat: { cron: '0 0 * * 0' },
          removeOnComplete: true
        }
      );
    }

    // Backup - daily at 3 AM (production only)
    if (config.app.isProduction) {
      this.queues.backup.add(
        'backup-database',
        {},
        {
          repeat: { cron: '0 3 * * *' },
          removeOnComplete: false
        }
      );
    }
  }

  setupEventHandlers() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      queue.on('completed', (job) => {
        logger.info(`Job ${job.id} in ${name} queue completed`);
      });

      queue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} in ${name} queue failed:`, err);
      });

      queue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} in ${name} queue stalled`);
      });
    });
  }

  // Public methods for adding jobs
  async addEmailJob(type, data, options = {}) {
    return this.queues.email.add(type, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true,
      removeOnFail: false,
      ...options
    });
  }

  async addContractJob(type, data, options = {}) {
    return this.queues.contract.add(type, data, {
      attempts: 2,
      removeOnComplete: true,
      ...options
    });
  }

  async addNotificationJob(data, options = {}) {
    return this.queues.notification.add('send-notification', data, {
      attempts: 3,
      removeOnComplete: true,
      ...options
    });
  }

  async addAnalyticsJob(type, data, options = {}) {
    return this.queues.analytics.add(type, data, {
      attempts: 1,
      removeOnComplete: true,
      ...options
    });
  }

  // Get queue statistics
  async getQueueStats() {
    const stats = {};
    
    for (const [name, queue] of Object.entries(this.queues)) {
      const counts = await queue.getJobCounts();
      stats[name] = {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed
      };
    }
    
    return stats;
  }

  // Clean specific queue
  async cleanQueue(queueName, grace = 0) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.clean(grace);
    logger.info(`Cleaned queue: ${queueName}`);
  }

  // Pause/resume queue
  async pauseQueue(queueName) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info(`Paused queue: ${queueName}`);
  }

  async resumeQueue(queueName) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info(`Resumed queue: ${queueName}`);
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down job queues...');
    
    const closePromises = Object.entries(this.queues).map(([name, queue]) => {
      return queue.close().then(() => {
        logger.info(`Queue ${name} closed`);
      });
    });

    await Promise.all(closePromises);
    logger.info('All job queues shut down');
  }
}

module.exports = new JobManager();