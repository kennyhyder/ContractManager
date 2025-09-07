const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { EmailLog } = require('../models');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = {};
    this.initialized = false;
  }

  /**
   * Initialize email service
   */
  async initialize() {
    try {
      // Create transporter
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify connection
      await this.transporter.verify();
      
      // Load email templates
      await this.loadTemplates();
      
      this.initialized = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Email service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load email templates
   */
  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates/emails');
      const templateFiles = await fs.readdir(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = file.replace('.hbs', '');
          const templatePath = path.join(templatesDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf8');
          
          this.templates[templateName] = handlebars.compile(templateContent);
        }
      }

      // Register partials
      const partialsDir = path.join(templatesDir, 'partials');
      try {
        const partialFiles = await fs.readdir(partialsDir);
        
        for (const file of partialFiles) {
          if (file.endsWith('.hbs')) {
            const partialName = file.replace('.hbs', '');
            const partialPath = path.join(partialsDir, file);
            const partialContent = await fs.readFile(partialPath, 'utf8');
            
            handlebars.registerPartial(partialName, partialContent);
          }
        }
      } catch (error) {
        logger.warn('No email partials directory found');
      }

      logger.info(`Loaded ${Object.keys(this.templates).length} email templates`);
    } catch (error) {
      logger.error('Failed to load email templates:', error);
      throw error;
    }
  }

  /**
   * Send email
   */
  async sendEmail(options) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        to,
        cc,
        bcc,
        subject,
        template,
        data = {},
        attachments = [],
        priority = 'normal',
        replyTo
      } = options;

      // Get template
      let html, text;
      if (template && this.templates[template]) {
        html = this.templates[template](data);
        text = this.stripHtml(html);
      } else {
        html = data.html;
        text = data.text || this.stripHtml(html);
      }

      // Prepare mail options
      const mailOptions = {
        from: process.env.SMTP_FROM,
        to,
        cc,
        bcc,
        subject,
        html,
        text,
        attachments,
        priority,
        replyTo: replyTo || process.env.SMTP_REPLY_TO
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      // Log email
      await this.logEmail({
        to,
        subject,
        template,
        status: 'sent',
        messageId: info.messageId,
        response: info.response
      });

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      logger.error('Send email error:', error);
      
      // Log failed email
      await this.logEmail({
        to: options.to,
        subject: options.subject,
        template: options.template,
        status: 'failed',
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(recipients, options) {
    try {
      const results = {
        sent: [],
        failed: []
      };

      // Send emails in batches
      const batchSize = 10;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        
        const promises = batch.map(recipient => 
          this.sendEmail({
            ...options,
            to: recipient.email,
            data: {
              ...options.data,
              ...recipient.data
            }
          })
          .then(result => results.sent.push({ email: recipient.email, ...result }))
          .catch(error => results.failed.push({ email: recipient.email, error: error.message }))
        );

        await Promise.all(promises);
      }

      return results;
    } catch (error) {
      logger.error('Send bulk emails error:', error);
      throw error;
    }
  }

  /**
   * Log email
   */
  async logEmail(data) {
    try {
      await EmailLog.create({
        to: data.to,
        subject: data.subject,
        template: data.template,
        status: data.status,
        messageId: data.messageId,
        response: data.response,
        error: data.error,
        sentAt: data.status === 'sent' ? new Date() : undefined
      });
    } catch (error) {
      logger.error('Email logging error:', error);
    }
  }

  /**
   * Track email open
   */
  async trackOpen(emailId) {
    try {
      await EmailLog.findByIdAndUpdate(emailId, {
        opened: true,
        openedAt: new Date()
      });
    } catch (error) {
      logger.error('Track email open error:', error);
    }
  }

  /**
   * Track email click
   */
  async trackClick(emailId, link) {
    try {
      await EmailLog.findByIdAndUpdate(emailId, {
        $push: {
          clicks: {
            link,
            clickedAt: new Date()
          }
        }
      });
    } catch (error) {
      logger.error('Track email click error:', error);
    }
  }

  /**
   * Get email statistics
   */
  async getEmailStats(options = {}) {
    try {
      const { startDate, endDate, template } = options;
      
      const query = {};
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      if (template) query.template = template;

      const stats = await EmailLog.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            opened: { $sum: { $cond: ['$opened', 1, 0] } },
            clicked: { $sum: { $cond: [{ $gt: [{ $size: '$clicks' }, 0] }, 1, 0] } }
          }
        }
      ]);

      return stats[0] || {
        total: 0,
        sent: 0,
        failed: 0,
        opened: 0,
        clicked: 0
      };
    } catch (error) {
      logger.error('Get email stats error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Test email configuration
   */
  async testConfiguration() {
    try {
      await this.sendEmail({
        to: process.env.SMTP_TEST_EMAIL || process.env.SMTP_USER,
        subject: 'Email Configuration Test',
        template: 'test',
        data: {
          timestamp: new Date().toISOString()
        }
      });

      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();