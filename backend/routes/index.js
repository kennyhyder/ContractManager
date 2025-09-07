const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const contractRoutes = require('./contracts');
const templateRoutes = require('./templates');
const userRoutes = require('./users');
const commentRoutes = require('./comments');
const approvalRoutes = require('./approvals');
const activityRoutes = require('./activities');
const emailRoutes = require('./emails');
const notificationRoutes = require('./notifications');

// Mount routes
router.use('/auth', authRoutes);
router.use('/contracts', contractRoutes);
router.use('/templates', templateRoutes);
router.use('/users', userRoutes);
router.use('/comments', commentRoutes);
router.use('/approvals', approvalRoutes);
router.use('/activities', activityRoutes);
router.use('/emails', emailRoutes);
router.use('/notifications', notificationRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Contract Management API',
    version: process.env.API_VERSION || '1.0.0',
    endpoints: {
      auth: '/api/auth',
      contracts: '/api/contracts',
      templates: '/api/templates',
      users: '/api/users',
      comments: '/api/comments',
      approvals: '/api/approvals',
      activities: '/api/activities',
      emails: '/api/emails',
      notifications: '/api/notifications'
    }
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;