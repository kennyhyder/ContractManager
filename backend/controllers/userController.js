const UserService = require('../services/UserService');
const PaymentService = require('../services/PaymentService');
const IntegrationService = require('../services/IntegrationService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

class UserController {
  /**
   * Get user profile
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.params.id || req.user._id;

      // Check if user can access this profile
      if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const profile = await UserService.getProfile(userId);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      next(error);
    }
  }

  /**
   * Update profile
   */
  async updateProfile(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user._id;
      const updates = req.body;

      const profile = await UserService.updateProfile(userId, updates);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: profile
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          code: 'NO_FILE'
        });
      }

      const userId = req.user._id;
      const result = await UserService.updateAvatar(userId, req.file);

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: result
      });
    } catch (error) {
      logger.error('Upload avatar error:', error);
      next(error);
    }
  }

  /**
   * Delete avatar
   */
  async deleteAvatar(req, res, next) {
    try {
      const userId = req.user._id;

      await UserService.updateProfile(userId, { avatar: null });

      res.json({
        success: true,
        message: 'Avatar deleted successfully'
      });
    } catch (error) {
      logger.error('Delete avatar error:', error);
      next(error);
    }
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(req, res, next) {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId).select('notificationSettings');

      res.json({
        success: true,
        data: user.notificationSettings || {}
      });
    } catch (error) {
      logger.error('Get notification settings error:', error);
      next(error);
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(req, res, next) {
    try {
      const userId = req.user._id;
      const settings = req.body;

      const updated = await UserService.updateNotificationSettings(userId, settings);

      res.json({
        success: true,
        message: 'Notification settings updated successfully',
        data: updated
      });
    } catch (error) {
      logger.error('Update notification settings error:', error);
      next(error);
    }
  }

  /**
   * Get user activity
   */
  async getUserActivity(req, res, next) {
    try {
      const userId = req.params.id || req.user._id;
      const { page = 1, limit = 20, startDate, endDate } = req.query;

      // Check permissions
      if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const activity = await UserService.getUserActivity(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        startDate,
        endDate
      });

      res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      logger.error('Get user activity error:', error);
      next(error);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(req, res, next) {
    try {
      const userId = req.user._id;
      const stats = await UserService.getUserStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get user stats error:', error);
      next(error);
    }
  }

  /**
   * Search users
   */
  async searchUsers(req, res, next) {
    try {
      const { 
        q: query, 
        page = 1, 
        limit = 20, 
        role, 
        department 
      } = req.query;

      const users = await UserService.searchUsers(query, {
        page: parseInt(page),
        limit: parseInt(limit),
        role,
        department,
        excludeIds: [req.user._id]
      });

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('Search users error:', error);
      next(error);
    }
  }

  /**
   * Get integrations
   */
  async getIntegrations(req, res, next) {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId).select('integrations');

      const integrations = IntegrationService.getAvailableIntegrations();
      
      const integrationsWithStatus = integrations.map(integration => ({
        ...integration,
        connected: !!user.integrations?.[integration.id]?.connected,
        connectedAt: user.integrations?.[integration.id]?.connectedAt
      }));

      res.json({
        success: true,
        data: integrationsWithStatus
      });
    } catch (error) {
      logger.error('Get integrations error:', error);
      next(error);
    }
  }

  /**
   * Connect integration
   */
  async connectIntegration(req, res, next) {
    try {
      const { integrationId } = req.params;
      const userId = req.user._id;
      const authData = req.body;

      const result = await IntegrationService.connectIntegration(
        userId,
        integrationId,
        authData
      );

      res.json({
        success: true,
        message: 'Integration connected successfully',
        data: result
      });
    } catch (error) {
      logger.error('Connect integration error:', error);
      
      if (error.message === 'Invalid integration') {
        return res.status(400).json({
          error: 'Invalid integration',
          code: 'INVALID_INTEGRATION'
        });
      }
      
      next(error);
    }
  }

  /**
   * Disconnect integration
   */
  async disconnectIntegration(req, res, next) {
    try {
      const { integrationId } = req.params;
      const userId = req.user._id;

      await IntegrationService.disconnectIntegration(userId, integrationId);

      res.json({
        success: true,
        message: 'Integration disconnected successfully'
      });
    } catch (error) {
      logger.error('Disconnect integration error:', error);
      next(error);
    }
  }

  /**
   * Get subscription info
   */
  async getSubscription(req, res, next) {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId).select('subscription');

      const usage = await PaymentService.checkUsageLimit(userId, 'contracts');

      res.json({
        success: true,
        data: {
          subscription: user.subscription || { plan: 'free' },
          usage
        }
      });
    } catch (error) {
      logger.error('Get subscription error:', error);
      next(error);
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(req, res, next) {
    try {
      const userId = req.user._id;
      const { planId, paymentMethodId } = req.body;

      const result = await PaymentService.createSubscription(
        userId,
        planId,
        paymentMethodId
      );

      res.json({
        success: true,
        message: 'Subscription updated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Update subscription error:', error);
      
      if (error.message === 'Invalid plan') {
        return res.status(400).json({
          error: 'Invalid plan',
          code: 'INVALID_PLAN'
        });
      }
      
      next(error);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(req, res, next) {
    try {
      const userId = req.user._id;
      const { reason } = req.body;

      const result = await PaymentService.cancelSubscription(userId, reason);

      res.json({
        success: true,
        message: 'Subscription cancelled successfully',
        data: result
      });
    } catch (error) {
      logger.error('Cancel subscription error:', error);
      next(error);
    }
  }

  /**
   * Get billing history
   */
  async getBillingHistory(req, res, next) {
    try {
      const userId = req.user._id;
      const history = await PaymentService.getBillingHistory(userId);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Get billing history error:', error);
      next(error);
    }
  }

  /**
   * Delete account
   */
  async deleteAccount(req, res, next) {
    try {
      const userId = req.user._id;
      const { password, reason } = req.body;

      // Verify password
      const user = await User.findById(userId).select('+password');
      const isValid = await bcrypt.compare(password, user.password);
      
      if (!isValid) {
        return res.status(401).json({
          error: 'Invalid password',
          code: 'INVALID_PASSWORD'
        });
      }

      // Mark account for deletion
      user.deletedAt = new Date();
      user.deletionReason = reason;
      user.isActive = false;
      await user.save();

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'user.account_deleted',
        resource: { type: 'user', id: userId },
        details: { reason }
      });

      // Clear session
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Account scheduled for deletion. You have 30 days to reactivate.'
      });
    } catch (error) {
      logger.error('Delete account error:', error);
      next(error);
    }
  }
}

module.exports = new UserController();