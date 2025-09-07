const express = require('express');
const router = express.Router();
const { Notification } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      read,
      type,
      priority,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {
      user: req.user._id,
      expiresAt: { $gt: new Date() }
    };

    if (read !== undefined) query.read = read === 'true';
    if (type) query.type = type;
    if (priority) query.priority = priority;

    // Get notifications
    const notifications = await Notification
      .find(query)
      .populate('from', 'firstName lastName avatar')
      .populate('resource.id')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch notifications' 
    });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get unread count' 
    });
  }
});

/**
 * @route   POST /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.post('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Mark as read error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark notification as read' 
    });
  }
});

/**
 * @route   POST /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.post('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user._id);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Mark all as read error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark notifications as read' 
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await Notification.deleteOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete notification' 
    });
  }
});

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private
 */
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const { email, push, inApp, sms } = req.body;

    const updates = {};
    
    if (email !== undefined) {
      updates['notifications.email'] = email;
    }
    
    if (push !== undefined) {
      updates['notifications.push'] = push;
    }
    
    if (inApp !== undefined) {
      updates['notifications.inApp'] = inApp;
    }
    
    if (sms !== undefined) {
      updates['notifications.sms'] = sms;
    }

    await User.findByIdAndUpdate(req.user._id, updates);

    res.json({
      success: true,
      message: 'Notification preferences updated'
    });
  } catch (error) {
    logger.error('Update preferences error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update preferences' 
    });
  }
});

module.exports = router;