const Bull = require('bull');
const cleanupProcessor = require('./processors/cleanupProcessor');
const logger = require('../utils/logger');

class CleanupQueue {
  constructor() {
    this.queue = new Bull('cleanup', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      }
    });

    this.setupProcessors();
    this.setupEventHandlers();
    this.scheduleRecurringJobs();
  }

  setupProcessors() {
    this.queue.process('clean-temp-files', cleanupProcessor.cleanTempFiles);
    this.queue.process('clean-expired-tokens', cleanupProcessor.cleanExpiredTokens);
    this.queue.process('clean-old-logs', cleanupProcessor.cleanOldLogs);
    this.queue.process('clean-deleted-contracts', cleanupProcessor.cleanDeletedContracts);
    this.queue.process('clean-orphaned-files', cleanupProcessor.cleanOrphanedFiles);
    this.queue.process('archive-old-data', cleanupProcessor.archiveOldData);
  }

  setupEventHandlers() {
    this.queue.on('completed', (job, result) => {
      logger.info(`Cleanup job ${job.id} completed:`, {
        type: job.name,
        result
      });
    });

    this.queue.on('failed', (job, err) => {
      logger.error(`Cleanup job ${job.id} failed:`, {
        type: job.name,
        error: err.message
      });
    });
  }

  scheduleRecurringJobs() {
    // Temp files cleanup - every 6 hours
    this.queue.add('clean-temp-files', {}, {
      repeat: { cron: '0 */6 * * *' },
      jobId: 'temp-files-cleanup'
    });

    // Expired tokens cleanup - daily at 3 AM
    this.queue.add('clean-expired-tokens', {}, {
      repeat: { cron: '0 3 * * *' },
      jobId: 'expired-tokens-cleanup'
    });

    // Old logs cleanup - weekly on Sunday at 2 AM
    this.queue.add('clean-old-logs', { retentionDays: 30 }, {
      repeat: { cron: '0 2 * * 0' },
      jobId: 'old-logs-cleanup'
    });

    // Deleted contracts cleanup - daily at 4 AM
    this.queue.add('clean-deleted-contracts', { daysBeforePermanentDelete: 30 }, {
      repeat: { cron: '0 4 * * *' },
      jobId: 'deleted-contracts-cleanup'
    });

    // Orphaned files cleanup - weekly on Saturday at 3 AM
    this.queue.add('clean-orphaned-files', {}, {
      repeat: { cron: '0 3 * * 6' },
      jobId: 'orphaned-files-cleanup'
    });

    // Archive old data - monthly on the 1st at 2 AM
    this.queue.add('archive-old-data', { archiveAfterDays: 365 }, {
      repeat: { cron: '0 2 1 * *' },
      jobId: 'archive-old-data'
    });

    logger.info('Recurring cleanup jobs scheduled');
  }

  // Manual cleanup triggers
  async triggerTempFileCleanup(maxAge) {
    const job = await this.queue.add('clean-temp-files', { maxAge });
    return job.id;
  }

  async triggerTokenCleanup() {
    const job = await this.queue.add('clean-expired-tokens', {});
    return job.id;
  }

  async triggerLogCleanup(retentionDays) {
    const job = await this.queue.add('clean-old-logs', { retentionDays });
    return job.id;
  }

  async triggerFullCleanup() {
    const jobs = await Promise.all([
      this.queue.add('clean-temp-files', {}),
      this.queue.add('clean-expired-tokens', {}),
      this.queue.add('clean-old-logs', { retentionDays: 30 }),
      this.queue.add('clean-orphaned-files', {})
    ]);

    return jobs.map(j => j.id);
  }

  async getCleanupStats() {
    const jobCounts = await this.queue.getJobCounts();
    const completedJobs = await this.queue.getCompleted(0, 100);
    
    const stats = {
      pending: jobCounts.waiting + jobCounts.delayed,
      active: jobCounts.active,
      completed: jobCounts.completed,
      failed: jobCounts.failed,
      recentJobs: completedJobs.map(job => ({
        id: job.id,
        type: job.name,
        completedAt: new Date(job.finishedOn),
        result: job.returnvalue
      }))
    };

    return stats;
  }

  async close() {
    await this.queue.close();
    logger.info('Cleanup queue closed');
  }
}

module.exports = new CleanupQueue();