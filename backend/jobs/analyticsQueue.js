const Bull = require('bull');
const analyticsProcessor = require('./processors/analyticsProcessor');
const logger = require('../utils/logger');

class AnalyticsQueue {
  constructor() {
    this.queue = new Bull('analytics', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    this.setupProcessors();
    this.setupEventHandlers();
    this.scheduleRecurringJobs();
  }

  setupProcessors() {
    this.queue.process('generate-report', 2, analyticsProcessor.generateReport);
    this.queue.process('calculate-metrics', 3, analyticsProcessor.calculateMetrics);
    this.queue.process('export-data', 1, this.processDataExport.bind(this));
    this.queue.process('generate-insights', 2, this.processInsights.bind(this));
  }

  setupEventHandlers() {
    this.queue.on('completed', (job, result) => {
      logger.info(`Analytics job ${job.id} completed:`, {
        type: job.name,
        duration: job.finishedOn - job.processedOn
      });
    });

    this.queue.on('failed', (job, err) => {
      logger.error(`Analytics job ${job.id} failed:`, {
        type: job.name,
        error: err.message,
        stack: err.stack
      });
    });

    this.queue.on('progress', (job, progress) => {
      logger.debug(`Analytics job ${job.id} progress: ${progress}%`);
    });
  }

  scheduleRecurringJobs() {
    // Daily metrics calculation at 1 AM
    this.queue.add('calculate-metrics', { type: 'daily' }, {
      repeat: { cron: '0 1 * * *' },
      jobId: 'daily-metrics'
    });

    // Weekly metrics on Monday at 2 AM
    this.queue.add('calculate-metrics', { type: 'weekly' }, {
      repeat: { cron: '0 2 * * 1' },
      jobId: 'weekly-metrics'
    });

    // Monthly metrics on 1st at 3 AM
    this.queue.add('calculate-metrics', { type: 'monthly' }, {
      repeat: { cron: '0 3 1 * *' },
      jobId: 'monthly-metrics'
    });

    // Weekly executive report on Monday at 8 AM
    this.queue.add('generate-report', {
      type: 'executive',
      format: 'pdf',
      startDate: 'last-week',
      endDate: 'now'
    }, {
      repeat: { cron: '0 8 * * 1' },
      jobId: 'weekly-executive-report'
    });

    logger.info('Recurring analytics jobs scheduled');
  }

  // Add report generation job
  async generateReport(type, options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate = new Date(),
      format = 'pdf',
      userId = null,
      email = null
    } = options;

    const job = await this.queue.add('generate-report', {
      type,
      startDate,
      endDate,
      format,
      userId,
      email
    }, {
      priority: options.priority || 0,
      delay: options.delay || 0
    });

    logger.info(`Report generation job ${job.id} queued: ${type}`);
    return job;
  }

  // Process data export
  async processDataExport(job) {
    const { userId, dataType, format = 'csv', filters = {} } = job.data;

    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      let data;
      switch (dataType) {
        case 'contracts':
          data = await this.exportContracts(userId, filters);
          break;
        case 'activities':
          data = await this.exportActivities(userId, filters);
          break;
        case 'all':
          data = await this.exportAllUserData(userId);
          break;
        default:
          throw new Error(`Unknown export type: ${dataType}`);
      }

      // Convert to requested format
      let exportPath;
      if (format === 'csv') {
        exportPath = await analyticsProcessor.generateCSVReport(dataType, data);
      } else if (format === 'json') {
        exportPath = await analyticsProcessor.generateJSONReport(dataType, data);
      } else {
        exportPath = await analyticsProcessor.generatePDFReport(dataType, data, {
          title: `${dataType} Export`,
          user: user.name
        });
      }

      // Send email with download link
      if (job.data.email) {
        const EmailQueue = require('./emailQueue');
        await EmailQueue.addEmail({
          to: user.email,
          subject: `Your ${dataType} export is ready`,
          template: 'data-export',
          context: {
            name: user.name,
            dataType,
            downloadUrl: exportPath,
            expiresIn: '24 hours'
          }
        });
      }

      return { exportPath, recordCount: data.length };
    } catch (error) {
      logger.error('Data export failed:', error);
      throw error;
    }
  }

  // Process insights generation
  async processInsights(job) {
    const { userId, period = 'month' } = job.data;

    try {
      const insights = await this.generateUserInsights(userId, period);
      
      // Store insights
      const Insight = require('../models/Insight');
      await Insight.create({
        user: userId,
        period,
        data: insights,
        generatedAt: new Date()
      });

      // Send notification
      const NotificationService = require('../services/NotificationService');
      await NotificationService.sendNotification({
        userId,
        type: 'insights-ready',
        title: `Your ${period}ly insights are ready`,
        message: 'Check out your personalized insights and recommendations',
        data: { period, highlights: insights.highlights }
      });

      return insights;
    } catch (error) {
      logger.error('Insights generation failed:', error);
      throw error;
    }
  }

  async exportContracts(userId, filters) {
    const Contract = require('../models/Contract');
    const query = {
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ],
      ...filters
    };

    return Contract.find(query)
      .populate('owner', 'name email')
      .populate('template', 'name')
      .lean();
  }

  async exportActivities(userId, filters) {
    const Activity = require('../models/Activity');
    return Activity.find({
      user: userId,
      ...filters
    }).lean();
  }

  async exportAllUserData(userId) {
    const [contracts, activities, comments, notifications] = await Promise.all([
      this.exportContracts(userId, {}),
      this.exportActivities(userId, {}),
      require('../models/Comment').find({ author: userId }).lean(),
      require('../models/Notification').find({ recipient: userId }).lean()
    ]);

    return {
      contracts,
      activities,
      comments,
      notifications,
      exportDate: new Date()
    };
  }

  async generateUserInsights(userId, period) {
    const Contract = require('../models/Contract');
    const Activity = require('../models/Activity');
    const moment = require('moment');

    const startDate = moment().subtract(1, period).toDate();
    const previousStartDate = moment().subtract(2, period).toDate();
    const previousEndDate = moment().subtract(1, period).toDate();

    // Get current period stats
    const [
      currentContracts,
      previousContracts,
      currentActivities,
      contractsByStatus,
      contractsByValue
    ] = await Promise.all([
      Contract.countDocuments({
        $or: [{ owner: userId }, { 'collaborators.user': userId }],
        createdAt: { $gte: startDate }
      }),
      Contract.countDocuments({
        $or: [{ owner: userId }, { 'collaborators.user': userId }],
        createdAt: { $gte: previousStartDate, $lt: previousEndDate }
      }),
      Activity.countDocuments({
        user: userId,
        createdAt: { $gte: startDate }
      }),
      Contract.aggregate([
        {
          $match: {
            $or: [{ owner: userId }, { 'collaborators.user': userId }],
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Contract.aggregate([
        {
          $match: {
            $or: [{ owner: userId }, { 'collaborators.user': userId }],
            createdAt: { $gte: startDate },
            value: { $exists: true }
          }
        },
        {
          $group: {
            _id: '$currency',
            totalValue: { $sum: '$value' },
            avgValue: { $avg: '$value' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const insights = {
      period,
      dateRange: { start: startDate, end: new Date() },
      contracts: {
        total: currentContracts,
        change: ((currentContracts - previousContracts) / previousContracts * 100).toFixed(1),
        byStatus: contractsByStatus,
        byValue: contractsByValue
      },
      activity: {
        total: currentActivities,
        avgPerDay: (currentActivities / moment().diff(startDate, 'days')).toFixed(1)
      },
      highlights: [],
      recommendations: []
    };

    // Generate highlights
    if (insights.contracts.change > 20) {
      insights.highlights.push(`Contract creation up ${insights.contracts.change}% from last ${period}`);
    }

    // Generate recommendations
    const draftContracts = contractsByStatus.find(s => s._id === 'draft');
    if (draftContracts && draftContracts.count > 5) {
      insights.recommendations.push({
        type: 'action',
        message: `You have ${draftContracts.count} draft contracts. Consider reviewing and finalizing them.`,
        priority: 'medium'
      });
    }

    return insights;
  }

  // Schedule a custom report
  async scheduleReport(type, schedule, options) {
    const job = await this.queue.add('generate-report', {
      type,
      ...options
    }, {
      repeat: { cron: schedule },
      jobId: `scheduled-${type}-${Date.now()}`
    });

    logger.info(`Scheduled report ${type} with cron: ${schedule}`);
    return job;
  }

  async getReportStatus(jobId) {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      type: job.name,
      status: await job.getState(),
      progress: job.progress(),
      createdAt: new Date(job.timestamp),
      startedAt: job.processedOn ? new Date(job.processedOn) : null,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      result: job.returnvalue,
      error: job.failedReason
    };
  }

  async getQueueStats() {
    const [jobCounts, workers] = await Promise.all([
      this.queue.getJobCounts(),
      this.queue.getWorkers()
    ]);

    return {
      jobs: jobCounts,
      workers: workers.length,
      isActive: jobCounts.active > 0,
      isPaused: await this.queue.isPaused()
    };
  }

  async close() {
    await this.queue.close();
    logger.info('Analytics queue closed');
  }
}

module.exports = new AnalyticsQueue();