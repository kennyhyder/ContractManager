const { Notification, User } = require('../../models');
const config = require('../../config');
const logger = require('../../utils/logger');
const webpush = require('web-push');

// Configure web push if available
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.SMTP_FROM}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

module.exports = {
  async sendNotification(job) {
    const { recipientId, type, title, message, data, priority } = job.data;

    try {
      logger.info(`Processing notification job ${job.id}: ${type} to ${recipientId}`);

      // Get recipient
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        throw new Error('Recipient not found');
      }

      // Create notification record
      const notification = await Notification.create({
        recipient: recipientId,
        type,
        title,
        message,
        data,
        priority,
        channels: []
      });

      // Send in-app notification via WebSocket
      const io = global.io;
      if (io) {
        io.to(`user:${recipientId}`).emit('notification', {
          id: notification._id,
          type,
          title,
          message,
          data,
          priority,
          createdAt: notification.createdAt
        });
        notification.channels.push('in-app');
      }

      // Send email notification if enabled
      if (recipient.preferences?.notifications?.email?.[type] !== false) {
        await job.queue.add('send-email', {
          to: recipient.email,
          subject: title,
          template: `notification-${type}`,
          context: {
            recipientName: recipient.name,
            title,
            message,
            ...data
          }
        }, { queue: 'email' });
        notification.channels.push('email');
      }

      // Send push notification if enabled and has subscription
      if (recipient.pushSubscriptions?.length > 0 && 
          recipient.preferences?.notifications?.push?.[type] !== false) {
        const pushPayload = JSON.stringify({
          title,
          body: message,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          data: {
            notificationId: notification._id,
            type,
            ...data
          }
        });

        const pushPromises = recipient.pushSubscriptions.map(subscription => 
          webpush.sendNotification(subscription, pushPayload)
            .catch(error => {
              if (error.statusCode === 410) {
                // Subscription expired, remove it
                recipient.pushSubscriptions = recipient.pushSubscriptions.filter(
                  sub => sub.endpoint !== subscription.endpoint
                );
              }
              logger.error(`Push notification failed for ${subscription.endpoint}:`, error);
            })
        );

        await Promise.all(pushPromises);
        notification.channels.push('push');
      }

      // Update notification with sent channels
      await notification.save();

      logger.info(`Notification ${notification._id} sent successfully via ${notification.channels.join(', ')}`);
      return { notificationId: notification._id, channels: notification.channels };
    } catch (error) {
      logger.error(`Failed to send notification job ${job.id}:`, error);
      throw error;
    }
  },

  async sendPushNotification(job) {
    const { userId, title, body, data, options = {} } = job.data;

    try {
      const user = await User.findById(userId);
      if (!user || !user.pushSubscriptions?.length) {
        logger.warn(`No push subscriptions for user ${userId}`);
        return { sent: 0 };
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: options.icon || '/icon-192x192.png',
        badge: options.badge || '/badge-72x72.png',
        vibrate: options.vibrate || [200, 100, 200],
        data: data || {},
        actions: options.actions || [],
        requireInteraction: options.requireInteraction || false
      });

      let successCount = 0;
      const failedEndpoints = [];

      for (const subscription of user.pushSubscriptions) {
        try {
          await webpush.sendNotification(subscription, payload);
          successCount++;
        } catch (error) {
          if (error.statusCode === 410) {
            failedEndpoints.push(subscription.endpoint);
          }
          logger.error(`Push failed for endpoint:`, error);
        }
      }

      // Remove failed subscriptions
      if (failedEndpoints.length > 0) {
        user.pushSubscriptions = user.pushSubscriptions.filter(
          sub => !failedEndpoints.includes(sub.endpoint)
        );
        await user.save();
      }

      logger.info(`Push notifications sent: ${successCount}/${user.pushSubscriptions.length}`);
      return { sent: successCount, failed: failedEndpoints.length };
    } catch (error) {
      logger.error(`Push notification job ${job.id} failed:`, error);
      throw error;
    }
  },

  async processBulkNotifications(job) {
    const { notifications } = job.data;
    const results = { sent: 0, failed: 0 };

    try {
      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        const batchPromises = batch.map(notification => 
          this.sendNotification({ 
            data: notification, 
            id: `bulk-${job.id}-${i}`,
            queue: job.queue
          })
          .then(() => { results.sent++; })
          .catch((error) => { 
            results.failed++; 
            logger.error(`Bulk notification failed:`, error);
          })
        );

        await Promise.all(batchPromises);

        // Update progress
        await job.progress(Math.round(((i + batch.length) / notifications.length) * 100));
      }

      logger.info(`Bulk notifications completed: ${results.sent} sent, ${results.failed} failed`);
      return results;
    } catch (error) {
      logger.error(`Bulk notification job ${job.id} failed:`, error);
      throw error;
    }
  }
};