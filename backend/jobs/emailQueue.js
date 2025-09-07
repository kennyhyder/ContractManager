const Bull = require('bull');
const emailProcessor = require('./processors/emailProcessor');
const logger = require('../utils/logger');

class EmailQueue {
  constructor() {
    this.queue = new Bull('email', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.setupProcessors();
    this.setupEventHandlers();
  }

  setupProcessors() {
    // Process different types of email jobs
    this.queue.process('send-email', 5, emailProcessor.sendEmail);
    this.queue.process('send-bulk-email', 2, emailProcessor.sendBulkEmail);
    this.queue.process('send-campaign', 1, this.processCampaign.bind(this));
    this.queue.process('send-digest', 3, this.processDigest.bind(this));
  }

  setupEventHandlers() {
    this.queue.on('completed', (job, result) => {
      logger.info(`Email job ${job.id} completed:`, {
        type: job.name,
        to: job.data.to,
        messageId: result.messageId
      });
    });

    this.queue.on('failed', (job, err) => {
      logger.error(`Email job ${job.id} failed:`, {
        type: job.name,
        to: job.data.to,
        error: err.message,
        attempts: job.attemptsMade
      });
    });

    this.queue.on('stalled', (job) => {
      logger.warn(`Email job ${job.id} stalled and will be retried`);
    });
  }

  // Add email to queue
  async addEmail(emailData, options = {}) {
    const jobOptions = {
      priority: emailData.priority === 'high' ? 1 : 0,
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      ...options
    };

    const job = await this.queue.add('send-email', emailData, jobOptions);
    logger.debug(`Email job ${job.id} added to queue`);
    return job;
  }

  // Add bulk email job
  async addBulkEmail(recipients, template, commonData, options = {}) {
    const jobData = {
      recipients,
      template,
      commonContext: commonData,
      subject: commonData.subject
    };

    const job = await this.queue.add('send-bulk-email', jobData, {
      attempts: 1,
      timeout: 30 * 60 * 1000, // 30 minutes
      ...options
    });

    logger.info(`Bulk email job ${job.id} added for ${recipients.length} recipients`);
    return job;
  }

  // Process email campaign
  async processCampaign(job) {
    const { campaignId, segmentId, template, subject } = job.data;

    try {
      // Get campaign recipients based on segment
      const User = require('../models/User');
      const recipients = await User.find({ 
        segments: segmentId,
        'preferences.emailCampaigns': true 
      }).select('email name');

      if (recipients.length === 0) {
        logger.warn(`No recipients for campaign ${campaignId}`);
        return { sent: 0 };
      }

      // Add bulk email job
      const bulkJob = await this.addBulkEmail(
        recipients.map(r => ({ email: r.email, name: r.name })),
        template,
        { subject, campaignId }
      );

      return { 
        recipientCount: recipients.length,
        bulkJobId: bulkJob.id 
      };
    } catch (error) {
      logger.error(`Campaign ${campaignId} processing failed:`, error);
      throw error;
    }
  }

  // Process digest emails
  async processDigest(job) {
    const { type = 'daily', userId } = job.data;

    try {
      const User = require('../models/User');
      const Activity = require('../models/Activity');
      const Contract = require('../models/Contract');

      // Get time range
      const since = type === 'daily' 
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      let query = {};
      if (userId) {
        query._id = userId;
      } else {
        query[`preferences.${type}Digest`] = true;
      }

      const users = await User.find(query);

      for (const user of users) {
        // Get user's activity summary
        const [contracts, activities, notifications] = await Promise.all([
          Contract.find({
            $or: [
              { owner: user._id },
              { 'collaborators.user': user._id }
            ],
            updatedAt: { $gte: since }
          }).limit(10),
          
          Activity.find({
            user: user._id,
            createdAt: { $gte: since }
          }).limit(20),
          
          Notification.find({
            recipient: user._id,
            createdAt: { $gte: since },
            isRead: false
          }).limit(10)
        ]);

        if (contracts.length > 0 || activities.length > 0 || notifications.length > 0) {
          await this.addEmail({
            to: user.email,
            template: `${type}-digest`,
            subject: `Your ${type} Contract Management Summary`,
            context: {
              name: user.name,
              period: type,
              contracts: contracts.map(c => ({
                title: c.title,
                status: c.status,
                url: `${process.env.FRONTEND_URL}/contracts/${c._id}`
              })),
              activities: activities.map(a => ({
                action: a.action,
                description: a.description,
                time: a.createdAt
              })),
              notificationCount: notifications.length
            }
          });
        }
      }

      return { processedUsers: users.length };
    } catch (error) {
      logger.error(`Digest processing failed:`, error);
      throw error;
    }
  }

  // Schedule recurring jobs
  async scheduleRecurringJobs() {
    // Daily digest at 9 AM
    await this.queue.add('send-digest', 
      { type: 'daily' }, 
      { 
        repeat: { cron: '0 9 * * *' },
        jobId: 'daily-digest'
      }
    );

    // Weekly digest on Mondays at 9 AM
    await this.queue.add('send-digest', 
      { type: 'weekly' }, 
      { 
        repeat: { cron: '0 9 * * 1' },
        jobId: 'weekly-digest'
      }
    );

    logger.info('Recurring email jobs scheduled');
  }

  // Queue maintenance
  async clean(grace = 0, type = 'completed') {
    const cleaned = await this.queue.clean(grace, type);
    logger.info(`Cleaned ${cleaned.length} ${type} email jobs`);
    return cleaned;
  }

  async getJobCounts() {
    return this.queue.getJobCounts();
  }

  async pause() {
    await this.queue.pause();
    logger.info('Email queue paused');
  }

  async resume() {
    await this.queue.resume();
    logger.info('Email queue resumed');
  }

  async close() {
    await this.queue.close();
    logger.info('Email queue closed');
  }
}

module.exports = new EmailQueue();