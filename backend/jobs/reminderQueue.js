const Bull = require('bull');
const logger = require('../utils/logger');
const moment = require('moment');

class ReminderQueue {
  constructor() {
    this.queue = new Bull('reminders', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      }
    });

    this.setupProcessors();
    this.setupEventHandlers();
  }

  setupProcessors() {
    this.queue.process('contract-expiry', this.processContractExpiry.bind(this));
    this.queue.process('approval-deadline', this.processApprovalDeadline.bind(this));
    this.queue.process('task-reminder', this.processTaskReminder.bind(this));
    this.queue.process('custom-reminder', this.processCustomReminder.bind(this));
  }

  setupEventHandlers() {
    this.queue.on('completed', (job) => {
      logger.info(`Reminder job ${job.id} completed: ${job.name}`);
    });

    this.queue.on('failed', (job, err) => {
      logger.error(`Reminder job ${job.id} failed:`, err);
    });
  }

  // Process contract expiry reminders
  async processContractExpiry(job) {
    const Contract = require('../models/Contract');
    const NotificationService = require('../services/NotificationService');

    try {
      const { daysBeforeExpiry = [30, 14, 7, 1] } = job.data;
      const now = new Date();
      let notificationsSent = 0;

      for (const days of daysBeforeExpiry) {
        const targetDate = moment().add(days, 'days').startOf('day').toDate();
        const endOfDay = moment().add(days, 'days').endOf('day').toDate();

        const expiringContracts = await Contract.find({
          status: 'active',
          endDate: {
            $gte: targetDate,
            $lte: endOfDay
          },
          [`reminders.${days}DayExpiry`]: { $ne: true }
        }).populate('owner collaborators.user');

        for (const contract of expiringContracts) {
          // Send notifications to all stakeholders
          const recipients = [
            contract.owner,
            ...contract.collaborators.map(c => c.user)
          ].filter(Boolean);

          for (const recipient of recipients) {
            await NotificationService.sendNotification({
              userId: recipient._id,
              type: 'contract-expiring',
              title: `Contract Expiring in ${days} Days`,
              message: `The contract "${contract.title}" will expire on ${moment(contract.endDate).format('MMM DD, YYYY')}`,
              data: {
                contractId: contract._id,
                contractTitle: contract.title,
                expiryDate: contract.endDate,
                daysRemaining: days
              },
              priority: days <= 7 ? 'high' : 'normal'
            });
            notificationsSent++;
          }

          // Mark reminder as sent
          if (!contract.reminders) contract.reminders = {};
          contract.reminders[`${days}DayExpiry`] = true;
          await contract.save();
        }
      }

      return { notificationsSent };
    } catch (error) {
      logger.error('Contract expiry reminder failed:', error);
      throw error;
    }
  }

  // Process approval deadline reminders
  async processApprovalDeadline(job) {
    const Approval = require('../models/Approval');
    const NotificationService = require('../services/NotificationService');

    try {
      const pendingApprovals = await Approval.find({
        status: 'pending',
        deadline: {
          $gte: new Date(),
          $lte: moment().add(2, 'days').toDate()
        },
        reminderSent: { $ne: true }
      }).populate('approver contract');

      let remindersSent = 0;

      for (const approval of pendingApprovals) {
        const hoursUntilDeadline = moment(approval.deadline).diff(moment(), 'hours');
        
        await NotificationService.sendNotification({
          userId: approval.approver._id,
          type: 'approval-deadline',
          title: 'Approval Deadline Approaching',
          message: `You have ${hoursUntilDeadline} hours to review "${approval.contract.title}"`,
          data: {
            approvalId: approval._id,
            contractId: approval.contract._id,
            contractTitle: approval.contract.title,
            deadline: approval.deadline
          },
          priority: 'high'
        });

        approval.reminderSent = true;
        await approval.save();
        remindersSent++;
      }

      return { remindersSent };
    } catch (error) {
      logger.error('Approval deadline reminder failed:', error);
      throw error;
    }
  }

  // Process task reminders
  async processTaskReminder(job) {
    const { taskId, userId, message, priority = 'normal' } = job.data;
    const NotificationService = require('../services/NotificationService');

    try {
      await NotificationService.sendNotification({
        userId,
        type: 'task-reminder',
        title: 'Task Reminder',
        message,
        data: { taskId },
        priority
      });

      return { success: true };
    } catch (error) {
      logger.error('Task reminder failed:', error);
      throw error;
    }
  }

  // Process custom reminders
  async processCustomReminder(job) {
    const { userId, title, message, data = {}, channels = ['email', 'in-app'] } = job.data;
    const NotificationService = require('../services/NotificationService');

    try {
      await NotificationService.sendNotification({
        userId,
        type: 'custom-reminder',
        title,
        message,
        data,
        channels
      });

      return { success: true };
    } catch (error) {
      logger.error('Custom reminder failed:', error);
      throw error;
    }
  }

  // Schedule a reminder
  async scheduleReminder(type, data, when) {
    const delay = moment(when).diff(moment());
    
    if (delay < 0) {
      throw new Error('Cannot schedule reminder in the past');
    }

    const job = await this.queue.add(type, data, {
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000 // 1 minute
      }
    });

    logger.info(`Reminder scheduled: ${type} at ${when} (job ${job.id})`);
    return job;
  }

  // Schedule recurring reminders
  async scheduleRecurringReminders() {
    // Contract expiry check - daily at 9 AM
    await this.queue.add('contract-expiry', {}, {
      repeat: { cron: '0 9 * * *' },
      jobId: 'daily-contract-expiry'
    });

    // Approval deadline check - every 4 hours
    await this.queue.add('approval-deadline', {}, {
      repeat: { cron: '0 */4 * * *' },
      jobId: 'approval-deadline-check'
    });

    logger.info('Recurring reminders scheduled');
  }

  // Cancel a scheduled reminder
  async cancelReminder(jobId) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`Reminder ${jobId} cancelled`);
      return true;
    }
    return false;
  }

  // Get upcoming reminders
  async getUpcomingReminders(userId) {
    const jobs = await this.queue.getJobs(['delayed', 'waiting']);
    
    return jobs
      .filter(job => job.data.userId === userId)
      .map(job => ({
        id: job.id,
        type: job.name,
        scheduledFor: new Date(job.timestamp + job.delay),
        data: job.data
      }));
  }

  async getStats() {
    const counts = await this.queue.getJobCounts();
    return {
      ...counts,
      upcoming: counts.delayed + counts.waiting
    };
  }

  async close() {
    await this.queue.close();
    logger.info('Reminder queue closed');
  }
}

module.exports = new ReminderQueue();