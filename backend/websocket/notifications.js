const logger = require('../utils/logger');
const { Notification } = require('../models');

/**
 * Handle real-time notification events
 */
module.exports = (io, socket) => {
  // Subscribe to notifications
  socket.on('subscribe-notifications', async () => {
    try {
      const userId = socket.userId;
      
      // Join user's notification room
      socket.join(`notifications:${userId}`);
      
      // Get unread count
      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        isRead: false
      });
      
      // Send initial unread count
      socket.emit('notification-count', { unread: unreadCount });
      
      logger.info(`User ${userId} subscribed to notifications`);
    } catch (error) {
      logger.error('Error subscribing to notifications:', error);
    }
  });

  // Mark notification as read
  socket.on('mark-notification-read', async (data) => {
    try {
      const { notificationId } = data;
      const userId = socket.userId;
      
      const notification = await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipient: userId
        },
        {
          isRead: true,
          readAt: new Date()
        },
        { new: true }
      );
      
      if (notification) {
        // Update unread count
        const unreadCount = await Notification.countDocuments({
          recipient: userId,
          isRead: false
        });
        
        socket.emit('notification-count', { unread: unreadCount });
        socket.emit('notification-updated', {
          id: notificationId,
          isRead: true,
          readAt: notification.readAt
        });
      }
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  });

  // Mark all notifications as read
  socket.on('mark-all-notifications-read', async () => {
    try {
      const userId = socket.userId;
      
      await Notification.updateMany(
        {
          recipient: userId,
          isRead: false
        },
        {
          isRead: true,
          readAt: new Date()
        }
      );
      
      socket.emit('notification-count', { unread: 0 });
      socket.emit('all-notifications-marked-read');
      
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    }
  });

  // Delete notification
  socket.on('delete-notification', async (data) => {
    try {
      const { notificationId } = data;
      const userId = socket.userId;
      
      const deleted = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId
      });
      
      if (deleted) {
        socket.emit('notification-deleted', { id: notificationId });
        
        // Update unread count if it was unread
        if (!deleted.isRead) {
          const unreadCount = await Notification.countDocuments({
            recipient: userId,
            isRead: false
          });
          
          socket.emit('notification-count', { unread: unreadCount });
        }
      }
    } catch (error) {
      logger.error('Error deleting notification:', error);
    }
  });

  // Get notifications with pagination
  socket.on('get-notifications', async (data) => {
    try {
      const { page = 1, limit = 20, filter = 'all' } = data;
      const userId = socket.userId;
      
      const query = { recipient: userId };
      
      if (filter === 'unread') {
        query.isRead = false;
      } else if (filter === 'read') {
        query.isRead = true;
      }
      
      const notifications = await Notification
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .populate('sender', 'name profilePicture')
        .populate('relatedContract', 'title')
        .lean();
      
      const total = await Notification.countDocuments(query);
      
      socket.emit('notifications-list', {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
      
    } catch (error) {
      logger.error('Error getting notifications:', error);
      socket.emit('notifications-error', {
        message: 'Failed to load notifications'
      });
    }
  });

  // Update notification preferences
  socket.on('update-notification-preferences', async (data) => {
    try {
      const { preferences } = data;
      const userId = socket.userId;
      
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, {
        'preferences.notifications': preferences
      });
      
      socket.emit('preferences-updated', { preferences });
      
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
    }
  });
};

/**
 * Send notification to specific user
 */
function sendNotificationToUser(io, userId, notification) {
  io.to(`notifications:${userId}`).emit('new-notification', notification);
}

/**
 * Broadcast notification to multiple users
 */
function broadcastNotification(io, userIds, notification) {
  userIds.forEach(userId => {
    sendNotificationToUser(io, userId, notification);
  });
}

module.exports.sendNotificationToUser = sendNotificationToUser;
module.exports.broadcastNotification = broadcastNotification;