const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class EmailConfig {
  constructor() {
    this.transporter = null;
    this.templates = new Map();
    this.initialized = false;
  }

  async initialize() {
    try {
      // Create transporter based on environment
      if (process.env.NODE_ENV === 'test') {
        // Use Ethereal email for testing
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      } else {
        // Production/Development configuration
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT, 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          rateDelta: 1000,
          rateLimit: 5,
        });
      }

      // Verify transporter configuration
      await this.transporter.verify();
      logger.info('Email transporter configured successfully');

      // Load email templates
      await this.loadTemplates();
      
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize email configuration:', error);
      throw error;
    }
  }

  async loadTemplates() {
    const templatesDir = path.join(__dirname, '../templates/emails');
    
    try {
      const templateFiles = await fs.readdir(templatesDir);
      
      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = file.replace('.hbs', '');
          const templatePath = path.join(templatesDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf-8');
          
          // Compile template
          const compiledTemplate = handlebars.compile(templateContent);
          this.templates.set(templateName, compiledTemplate);
          
          logger.info(`Loaded email template: ${templateName}`);
        }
      }

      // Register Handlebars helpers
      this.registerHelpers();
    } catch (error) {
      logger.error('Failed to load email templates:', error);
    }
  }

  registerHelpers() {
    // Date formatting helper
    handlebars.registerHelper('formatDate', (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    // Currency formatting helper
    handlebars.registerHelper('formatCurrency', (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    });

    // Conditional helper
    handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });
  }

  async sendMail(options) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      to,
      subject,
      template,
      context = {},
      attachments = [],
      cc,
      bcc,
      replyTo,
      priority = 'normal'
    } = options;

    try {
      // Get compiled template
      const compiledTemplate = this.templates.get(template);
      if (!compiledTemplate) {
        throw new Error(`Email template '${template}' not found`);
      }

      // Generate HTML from template
      const html = compiledTemplate(context);

      // Email options
      const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.SMTP_FROM}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        attachments,
        cc,
        bcc,
        replyTo: replyTo || process.env.SMTP_FROM,
        priority,
        headers: {
          'X-Application': 'Contract Management System',
          'X-Environment': process.env.NODE_ENV,
        }
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      // Log email sent
      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to,
        subject,
        template
      });

      // Return preview URL for test emails
      if (process.env.NODE_ENV === 'test') {
        return {
          messageId: info.messageId,
          previewUrl: nodemailer.getTestMessageUrl(info)
        };
      }

      return {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      };
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  // Specific email methods
  async sendWelcomeEmail(user) {
    return this.sendMail({
      to: user.email,
      subject: 'Welcome to Contract Management System',
      template: 'welcome',
      context: {
        name: user.name,
        email: user.email,
        loginUrl: `${process.env.FRONTEND_URL}/login`
      }
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    return this.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      context: {
        name: user.name,
        resetUrl,
        expiresIn: '1 hour'
      },
      priority: 'high'
    });
  }

  async sendContractNotification(user, contract, action) {
    return this.sendMail({
      to: user.email,
      subject: `Contract ${action}: ${contract.title}`,
      template: 'contract-notification',
      context: {
        name: user.name,
        contractTitle: contract.title,
        action,
        contractUrl: `${process.env.FRONTEND_URL}/contracts/${contract._id}`,
        deadline: contract.endDate
      }
    });
  }

  async sendApprovalRequest(approver, contract, requester) {
    return this.sendMail({
      to: approver.email,
      subject: `Approval Required: ${contract.title}`,
      template: 'approval-request',
      context: {
        approverName: approver.name,
        requesterName: requester.name,
        contractTitle: contract.title,
        contractUrl: `${process.env.FRONTEND_URL}/contracts/${contract._id}/approve`,
        deadline: contract.approvalDeadline
      },
      priority: 'high'
    });
  }

  async sendBulkEmail(recipients, subject, template, commonContext = {}) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendMail({
          to: recipient.email,
          subject,
          template,
          context: {
            ...commonContext,
            name: recipient.name,
            email: recipient.email
          }
        });
        results.push({ success: true, email: recipient.email, result });
      } catch (error) {
        results.push({ success: false, email: recipient.email, error: error.message });
      }
    }
    
    return results;
  }

  // Queue email for background processing
  async queueEmail(emailData) {
    // This would integrate with a job queue like Bull
    // For now, we'll send immediately
    return this.sendMail(emailData);
  }

  async close() {
    if (this.transporter) {
      this.transporter.close();
      logger.info('Email transporter closed');
    }
  }
}

module.exports = new EmailConfig();