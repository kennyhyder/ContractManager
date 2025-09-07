const { Contract, User, Notification } = require('../models');
const EmailService = require('./EmailService');
const NotificationService = require('./NotificationService');
const ActivityService = require('./ActivityService');
const { redis } = require('../middleware/cache');
const logger = require('../utils/logger');
const moment = require('moment');

class ReminderService {
  constructor() {
    this.reminderTypes = {
      CONTRACT_EXPIRY: 'contract_expiry',
      CONTRACT_RENEWAL: 'contract_renewal',
      SIGNATURE_PENDING: 'signature_pending',
      APPROVAL_PENDING: 'approval_pending',
      CUSTOM: 'custom'
    };

    this.defaultReminders = {
      contract_expiry: [30, 14, 7, 1], // days before expiry
      contract_renewal: [60, 30, 14, 7], // days before renewal
      signature_pending: [3, 7, 14], // days after request
      approval_pending: [1, 3, 7] // days after request
    };
  }

  /**
   * Schedule reminder
   */
  async scheduleReminder(options) {
    try {
      const {
        type,
        resourceType,
        resourceId,
        userId,
        scheduledFor,
        customMessage,
        metadata = {}
      } = options;

      // Validate reminder type
      if (!Object.values(this.reminderTypes).includes(type)) {
        throw new Error('Invalid reminder type');
      }

      // Create reminder key
      const reminderKey = `reminder:${resourceType}:${resourceId}:${type}:${scheduledFor}`;
      
      // Check if reminder already exists
      const exists = await redis.exists(reminderKey);
      if (exists) {
        logger.info('Reminder already scheduled:', reminderKey);
        return { exists: true };
      }

      // Schedule reminder
      const reminder = {
        type,
        resourceType,
        resourceId,
        userId,
        scheduledFor: new Date(scheduledFor),
        customMessage,
        metadata,
        createdAt: new Date()
      };

      // Store in Redis with expiry
      const ttl = Math.max(0, moment(scheduledFor).diff(moment(), 'seconds'));
      await redis.setex(reminderKey, ttl + 86400, JSON.stringify(reminder)); // +1 day buffer

      // Also store in sorted set for efficient retrieval
      await redis.zadd(
        'reminders:schedule',
        moment(scheduledFor).unix(),
        reminderKey
      );

      logger.info('Reminder scheduled:', reminder);

      return reminder;
    } catch (error) {
      logger.error('Schedule reminder error:', error);
      throw error;
    }
  }

  /**
   * Schedule contract reminders
   */
  async scheduleContractReminders(contractId) {
    try {
      const contract = await Contract.findById(contractId)
        .populate('owner')
        .populate('parties');

      if (!contract) {
        throw new Error('Contract not found');
      }

      const reminders = [];

      // Schedule expiry reminders
      if (contract.dates?.expiry) {
        const expiryDate = moment(contract.dates.expiry);
        
        for (const daysBefore of this.defaultReminders.contract_expiry) {
          const reminderDate = expiryDate.clone().subtract(daysBefore, 'days');
          
          if (reminderDate.isAfter(moment())) {
            const reminder = await this.scheduleReminder({
              type: this.reminderTypes.CONTRACT_EXPIRY,
              resourceType: 'contract',
              resourceId: contractId,
              userId: contract.owner._id,
              scheduledFor: reminderDate.toDate(),
              metadata: {
                daysBeforeExpiry: daysBefore,
                contractTitle: contract.title,
                expiryDate: contract.dates.expiry
              }
            });
            
            if (!reminder.exists) {
              reminders.push(reminder);
            }
          }
        }
      }

      // Schedule renewal reminders
      if (contract.renewal?.isEnabled && contract.dates?.expiry) {
        const renewalDate = moment(contract.dates.expiry);
        
        for (const daysBefore of this.defaultReminders.contract_renewal) {
          const reminderDate = renewalDate.clone().subtract(daysBefore, 'days');
          
          if (reminderDate.isAfter(moment())) {
            const reminder = await this.scheduleReminder({
              type: this.reminderTypes.CONTRACT_RENEWAL,
              resourceType: 'contract',
              resourceId: contractId,
              userId: contract.owner._id,
              scheduledFor: reminderDate.toDate(),
              metadata: {
                daysBeforeRenewal: daysBefore,
                contractTitle: contract.title,
                renewalDate: contract.dates.expiry
              }
            });
            
            if (!reminder.exists) {
              reminders.push(reminder);
            }
          }
        }
      }

      // Schedule signature reminders for unsigned parties
      const unsignedParties = contract.parties.filter(p => 
        p.role === 'signatory' && !p.signedAt
      );

      for (const party of unsignedParties) {
        for (const daysAfter of this.defaultReminders.signature_pending) {
          const reminderDate = moment().add(daysAfter, 'days');
          
          const reminder = await this.scheduleReminder({
            type: this.reminderTypes.SIGNATURE_PENDING,
            resourceType: 'contract',
            resourceId: contractId,
            userId: contract.owner._id,
            scheduledFor: reminderDate.toDate(),
            metadata: {
              partyEmail: party.email,
              partyName: party.name,
              contractTitle: contract.title,
              daysOverdue: daysAfter
            }
          });
          
          if (!reminder.exists) {
            reminders.push(reminder);
          }
        }
      }

      return reminders;
    } catch (error) {
      logger.error('Schedule contract reminders error:', error);
      throw error;
    }
  }

  /**
   * Process due reminders
   */
  async processDueReminders() {
    try {
      const now = moment().unix();
      
      // Get due reminders
      const reminderKeys = await redis.zrangebyscore(
        'reminders:schedule',
        '-inf',
        now
      );

      logger.info(`Processing ${reminderKeys.length} due reminders`);

      const results = {
        processed: 0,
        failed: 0
      };

      for (const reminderKey of reminderKeys) {
        try {
          // Get reminder data
          const reminderData = await redis.get(reminderKey);
          if (!reminderData) {
            continue;
          }

          const reminder = JSON.parse(reminderData);
          
          // Process reminder
          await this.sendReminder(reminder);
          
          // Remove from queue
          await redis.zrem('reminders:schedule', reminderKey);
          await redis.del(reminderKey);
          
          results.processed++;
        } catch (error) {
          logger.error('Process reminder error:', error);
          results.failed++;
        }
      }

      return results;
    } catch (error) {
      logger.error('Process due reminders error:', error);
      throw error;
    }
  }

  /**
   * Send reminder
   */
  async sendReminder(reminder) {
    try {
      const { type, resourceType, resourceId, userId, metadata } = reminder;

      // Get resource
      let resource;
      if (resourceType === 'contract') {
        resource = await Contract.findById(resourceId);
        if (!resource) {
          logger.warn('Resource not found for reminder:', resourceId);
          return;
        }
      }

      // Get user
      const user = await User.findById(userId);
      if (!user) {
        logger.warn('User not found for reminder:', userId);
        return;
      }

      // Prepare notification data
      const notificationData = this.prepareNotificationData(type, resource, metadata);

      // Send notification
      await NotificationService.sendNotification({
        userId: user._id,
        type: `reminder_${type}`,
        title: notificationData.title,
        message: notificationData.message,
        data: {
          reminderType: type,
          resourceType,
          resourceId,
          ...metadata
        },
        channels: ['email', 'inApp'],
        priority: 'high'
      });

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'reminder.sent',
        resource: { type: resourceType, id: resourceId },
        details: {
          reminderType: type,
          title: notificationData.title
        }
      });

      logger.info('Reminder sent:', { type, resourceId, userId });
    } catch (error) {
      logger.error('Send reminder error:', error);
      throw error;
    }
  }

  /**
   * Get reminders
   */
  async getReminders(options = {}) {
    try {
      const {
        userId,
        resourceType,
        resourceId,
        type,
        startDate,
        endDate
      } = options;

      // Build pattern for scanning
      let pattern = 'reminder:';
      if (resourceType) pattern += `${resourceType}:`;
      if (resourceId) pattern += `${resourceId}:`;
      if (type) pattern += `${type}:`;
      pattern += '*';

      // Scan for matching keys
      const keys = await this.scanRedisKeys(pattern);
      
      const reminders = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const reminder = JSON.parse(data);
          
          // Apply filters
          if (userId && reminder.userId !== userId) continue;
          if (startDate && moment(reminder.scheduledFor).isBefore(startDate)) continue;
          if (endDate && moment(reminder.scheduledFor).isAfter(endDate)) continue;
          
          reminders.push({
            ...reminder,
            key
          });
        }
      }

      // Sort by scheduled date
      reminders.sort((a, b) => 
        moment(a.scheduledFor).diff(moment(b.scheduledFor))
      );

      return reminders;
    } catch (error) {
      logger.error('Get reminders error:', error);
      throw error;
    }
  }

  /**
   * Cancel reminder
   */
  async cancelReminder(reminderKey) {
    try {
      // Remove from schedule
      await redis.zrem('reminders:schedule', reminderKey);
      
      // Delete reminder data
      await redis.del(reminderKey);

      logger.info('Reminder cancelled:', reminderKey);

      return { success: true };
    } catch (error) {
      logger.error('Cancel reminder error:', error);
      throw error;
    }
  }

  /**
   * Cancel all reminders for resource
   */
  async cancelResourceReminders(resourceType, resourceId) {
    try {
      const pattern = `reminder:${resourceType}:${resourceId}:*`;
      const keys = await this.scanRedisKeys(pattern);

      for (const key of keys) {
        await this.cancelReminder(key);
      }

      logger.info(`Cancelled ${keys.length} reminders for ${resourceType}:${resourceId}`);

      return { cancelled: keys.length };
    } catch (error) {
      logger.error('Cancel resource reminders error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  prepareNotificationData(type, resource, metadata) {
    const templates = {
      contract_expiry: {
        title: 'Contract Expiring Soon',
        message: `Contract "${metadata.contractTitle}" expires in ${metadata.daysBeforeExpiry} days on ${moment(metadata.expiryDate).format('MMM DD, YYYY')}`
      },
      contract_renewal: {
        title: 'Contract Renewal Reminder',
        message: `Contract "${metadata.contractTitle}" is up for renewal in ${metadata.daysBeforeRenewal} days`
      },
      signature_pending: {
        title: 'Signature Required',
        message: `${metadata.partyName} has not yet signed "${metadata.contractTitle}". This signature has been pending for ${metadata.daysOverdue} days.`
      },
      approval_pending: {
        title: 'Approval Required',
        message: `Your approval is needed for "${metadata.title}"`
      },
      custom: {
        title: metadata.title || 'Reminder',
        message: metadata.message || 'You have a reminder'
      }
    };

    return templates[type] || templates.custom;
  }

  async scanRedisKeys(pattern) {
    const keys = [];
    let cursor = '0';

    do {
      const [newCursor, batch] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      
      cursor = newCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Get reminder statistics
   */
  async getReminderStats(options = {}) {
    try {
      const { userId, startDate, endDate } = options;

      const reminders = await this.getReminders({ userId, startDate, endDate });

      const stats = {
        total: reminders.length,
        byType: {},
        byResource: {},
        upcoming: 0,
        overdue: 0
      };

      const now = moment();

      reminders.forEach(reminder => {
        // By type
        stats.byType[reminder.type] = (stats.byType[reminder.type] || 0) + 1;

        // By resource
        stats.byResource[reminder.resourceType] = (stats.byResource[reminder.resourceType] || 0) + 1;

        // Timing
        if (moment(reminder.scheduledFor).isAfter(now)) {
          stats.upcoming++;
        } else {
          stats.overdue++;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Get reminder stats error:', error);
      throw error;
    }
  }
}

module.exports = new ReminderService();