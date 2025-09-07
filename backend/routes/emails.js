const express = require('express');
const router = express.Router();
const { Contract, EmailLog, User } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validateEmail } = require('../middleware/validation');
const EmailService = require('../services/EmailService');
const logger = require('../utils/logger');

/**
 * @route   POST /api/emails/send-contract
 * @desc    Send contract via email
 * @access  Private
 */
router.post('/send-contract', authMiddleware, validateEmail.sendContract, async (req, res) => {
  try {
    const { contractId, recipients, subject, message, includeAttachments } = req.body;

    // Get contract
    const contract = await Contract
      .findById(contractId)
      .populate('owner', 'firstName lastName email')
      .populate('attachments');

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check access
    if (!contract.hasAccess(req.user._id, 'share')) {
      return res.status(403).json({ 
        success: false,
        message: 'You do not have permission to share this contract' 
      });
    }

    // Send emails
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const emailData = {
          to: recipient.email,
          template: 'contract-share',
          data: {
            recipientName: recipient.name,
            senderName: req.user.fullName,
            contractTitle: contract.title,
            message: message,
            viewUrl: `${process.env.FRONTEND_URL}/shared/contracts/${contractId}`,
            expiresIn: '7 days'
          },
          subject: subject || `${req.user.fullName} shared a contract with you`,
          attachments: includeAttachments ? contract.attachments.map(a => ({
            filename: a.name,
            path: a.url
          })) : [],
          metadata: {
            contractId: contractId,
            sharedBy: req.user._id
          }
        };

        const result = await EmailService.sendEmail(emailData);
        
        results.push({
          recipient: recipient.email,
          success: true,
          messageId: result.messageId
        });

        // Log email
        await EmailLog.create({
          messageId: result.messageId,
          from: {
            email: req.user.email,
            name: req.user.fullName
          },
          to: [{
            email: recipient.email,
            name: recipient.name
          }],
          subject: emailData.subject,
          type: 'contract_share',
          contract: contractId,
          user: req.user._id,
          sentBy: req.user._id,
          status: 'sent',
          sentAt: new Date()
        });

      } catch (error) {
        logger.error(`Failed to send email to ${recipient.email}:`, error);
        results.push({
          recipient: recipient.email,
          success: false,
          error: error.message
        });
      }
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.shared_email',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: {
        recipientCount: recipients.length,
        successCount: results.filter(r => r.success).length
      }
    });

    res.json({
      success: true,
      message: 'Emails sent successfully',
      data: { results }
    });
  } catch (error) {
    logger.error('Send contract email error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send emails' 
    });
  }
});

/**
 * @route   POST /api/emails/send-reminder
 * @desc    Send reminder email
 * @access  Private
 */
router.post('/send-reminder', authMiddleware, validateEmail.sendReminder, async (req, res) => {
  try {
    const { contractId, recipients, reminderType, customMessage } = req.body;

    // Get contract
    const contract = await Contract.findById(contractId);

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check access
    if (!contract.hasAccess(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Determine reminder content
    let subject, template, templateData;

    switch (reminderType) {
      case 'expiring':
        subject = `Contract Expiring: ${contract.title}`;
        template = 'contract-expiring';
        templateData = {
          contractTitle: contract.title,
          expiryDate: contract.dates.expiration,
          daysUntilExpiry: contract.daysUntilExpiration
        };
        break;
      
      case 'renewal':
        subject = `Contract Renewal Notice: ${contract.title}`;
        template = 'contract-renewal';
        templateData = {
          contractTitle: contract.title,
          renewalDate: contract.dates.expiration
        };
        break;
      
      case 'signature':
        subject = `Action Required: Sign ${contract.title}`;
        template = 'signature-reminder';
        templateData = {
          contractTitle: contract.title,
          signUrl: `${process.env.FRONTEND_URL}/contracts/${contractId}/sign`
        };
        break;
      
      default:
        subject = `Reminder: ${contract.title}`;
        template = 'general-reminder';
        templateData = {
          contractTitle: contract.title,
          message: customMessage
        };
    }

    // Send reminders
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await EmailService.sendEmail({
          to: recipient.email,
          subject,
          template,
          data: {
            ...templateData,
            recipientName: recipient.name,
            senderName: req.user.fullName
          },
          metadata: {
            contractId,
            reminderType
          }
        });

        results.push({
          recipient: recipient.email,
          success: true,
          messageId: result.messageId
        });

      } catch (error) {
        results.push({
          recipient: recipient.email,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Reminders sent successfully',
      data: { results }
    });
  } catch (error) {
    logger.error('Send reminder error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send reminders' 
    });
  }
});

/**
 * @route   GET /api/emails/logs
 * @desc    Get email logs
 * @access  Private
 */
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const {
      contractId,
      type,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {
      sentBy: req.user._id
    };

    if (contractId) query.contract = contractId;
    if (type) query.type = type;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.sentAt = {};
      if (startDate) query.sentAt.$gte = new Date(startDate);
      if (endDate) query.sentAt.$lte = new Date(endDate);
    }

    // Get logs
    const logs = await EmailLog
      .find(query)
      .populate('contract', 'title')
      .populate('user', 'firstName lastName')
      .sort({ sentAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await EmailLog.countDocuments(query);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get email logs error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch email logs' 
    });
  }
});

/**
 * @route   GET /api/emails/stats
 * @desc    Get email statistics
 * @access  Private
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    const days = parseInt(period) || 30;
    startDate.setDate(startDate.getDate() - days);

    // Get stats
    const stats = await EmailLog.getStats(req.user._id, {
      start: startDate,
      end: endDate
    });

    res.json({
      success: true,
      data: {
        period,
        stats: stats[0] || {
          total: 0,
          sent: 0,
          delivered: 0,
          bounced: 0,
          failed: 0,
          opened: 0,
          clicked: 0,
          deliveryRate: 0,
          openRate: 0,
          clickRate: 0
        }
      }
    });
  } catch (error) {
    logger.error('Get email stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch email statistics' 
    });
  }
});

/**
 * @route   GET /api/emails/track/open/:emailId
 * @desc    Track email open
 * @access  Public
 */
router.get('/track/open/:emailId', async (req, res) => {
  try {
    const emailLog = await EmailLog.findOne({ 
      messageId: req.params.emailId 
    });

    if (emailLog) {
      await emailLog.recordOpen({
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
  } catch (error) {
    logger.error('Email open tracking error:', error);
  }

  // Return 1x1 transparent pixel
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );

  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });

  res.send(pixel);
});

/**
 * @route   GET /api/emails/track/click/:emailId
 * @desc    Track email click
 * @access  Public
 */
router.get('/track/click/:emailId', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send('Invalid URL');
    }

    const emailLog = await EmailLog.findOne({ 
      messageId: req.params.emailId 
    });

    if (emailLog) {
      await emailLog.recordClick({
        url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    res.redirect(url);
  } catch (error) {
    logger.error('Email click tracking error:', error);
    res.redirect(process.env.FRONTEND_URL || '/');
  }
});

module.exports = router;