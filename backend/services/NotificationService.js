const { Notification, User } = require('../models');
const EmailService = require('./EmailService');
const { redis } = require('../middleware/cache');
const logger = require('../utils/logger');
const io = require('../websocket');

class NotificationService {
  /**
   * Send notification
   */
  async sendNotification(options) {
    try {
      const {
        userId,
        type,
        title,
        message,
        data = {},
        channels = ['inApp'],
        priority = 'normal'
      } = options;

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const results = {};

      // In-app notification
      if (channels.includes('inApp')) {
        const notification = await this.createInAppNotification({
          recipient: userId,
          type,
          title,
          message,
          data,
          priority
        });
        results.inApp = notification;

        // Send real-time notification
        this.sendRealtimeNotification(userId, notification);
      }

      // Email notification
      if (channels.includes('email') && this.shouldSendEmail(user, type)) {
        const emailResult = await this.sendEmailNotification(user, {
          type,
          title,
          message,
          data
        });
        results.email = emailResult;
      }

      // Push notification
      if (channels.includes('push') && user.pushToken) {
        const pushResult = await this.sendPushNotification(user, {
          title,
          message,
          data
        });
        results.push = pushResult;
      }

      return results;
    } catch (error) {
      logger.error('Send notification error:', error);
      throw error;
    }
  }

  /**
   * Create in-app notification
   */
  async createInAppNotification(data) {
    try {
      const notification = new Notification({
        recipient: data.recipient,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        priority: data.priority,
        relatedTo: data.relatedTo
      });

      await notification.save();

      // Update unread count
      await this.updateUnreadCount(data.recipient);

      return notification;
    } catch (error) {
      logger.error('Create notification error:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(user, data) {
    try {
      const templateMap = {
        'contract_created': 'notification-contract-created',
        'contract_shared': 'notification-contract-shared',
        'contract_signed': 'notification-contract-signed',
        'approval_requested': 'notification-approval-requested',
        'comment_added': 'notification-comment',
        'mention': 'notification-mention'
      };

      const template = templateMap[data.type] || 'notification-generic';

      return await EmailService.sendEmail({
        to: user.email,
        subject: data.title,
        template,
        data: {
          firstName: user.firstName,
          title: data.title,
          message: data.message,
          actionUrl: `${process.env.FRONTEND_URL}/notifications`,
          ...data.data
        }
      });
    } catch (error) {
      logger.error('Send email notification error:', error);
      throw error;
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(user, data) {
    try {
      // This would integrate with a push notification service
      // like Firebase Cloud Messaging or OneSignal
      logger.info('Sending push notification:', {
        userId: user._id,
        token: user.pushToken,
        data
      });

      return { success: true };
    } catch (error) {
      logger.error('Send push notification error:', error);
      throw error;
    }
  }

  /**
   * Send realtime notification
   */
  sendRealtimeNotification(userId, notification) {
    try {
      // Emit to user's socket room
      io.to(`user:${userId}`).emit('notification', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt
      });
    } catch (error) {
      logger.error('Send realtime notification error:', error);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (!notification.read) {
        notification.read = true;
        notification.readAt = new Date();
        await notification.save();

        await this.updateUnreadCount(userId);
      }

      return notification;
    } catch (error) {
      logger.error('Mark as read error:', error);
      throw error;
    }
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId) {
    try {
      await Notification.updateMany(
        { recipient: userId, read: false },
        { read: true, readAt: new Date() }
      );

      await this.updateUnreadCount(userId);

      return { success: true };
    } catch (error) {
      logger.error('Mark all as read error:', error);
      throw error;
    }
  }

  /**
   * Get notifications
   */
  async getNotifications(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        types = []
      } = options;

      const query = { recipient: userId };
      
      if (unreadOnly) {
        query.read = false;
      }
      
      if (types.length > 0) {
        query.type = { $in: types };
      }

      const notifications = await Notification
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await Notification.countDocuments(query);
      const unread = await Notification.countDocuments({
        recipient: userId,
        read: false
      });

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        unread
      };
    } catch (error) {
      logger.error('Get notifications error:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {