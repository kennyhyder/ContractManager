const config = require('../../config');
const logger = require('../../utils/logger');
const EmailLog = require('../../models/EmailLog');

module.exports = {
  async sendEmail(job) {
    const { to, subject, template, context, attachments, priority } = job.data;

    try {
      logger.info(`Processing email job ${job.id}: ${subject} to ${to}`);

      // Send email
      const result = await config.email.sendMail({
        to,
        subject,
        template,
        context,
        attachments,
        priority
      });

      // Log email
      await EmailLog.create({
        to: Array.isArray(to) ? to : [to],
        subject,
        template,
        status: 'sent',
        messageId: result.messageId,
        sentAt: new Date(),
        metadata: {
          jobId: job.id,
          attempts: job.attemptsMade
        }
      });

      logger.info(`Email sent successfully: ${result.messageId}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send email job ${job.id}:`, error);

      // Log failed attempt
      await EmailLog.create({
        to: Array.isArray(to) ? to : [to],
        subject,
        template,
        status: 'failed',
        error: error.message,
        metadata: {
          jobId: job.id,
          attempts: job.attemptsMade
        }
      });

      throw error;
    }
  },

  async sendBulkEmail(job) {
    const { recipients, subject, template, commonContext } = job.data;
    const results = { sent: [], failed: [] };

    try {
      logger.info(`Processing bulk email job ${job.id}: ${recipients.length} recipients`);

      // Process in batches to avoid overwhelming the SMTP server
      const batchSize = 10;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (recipient) => {
          try {
            const result = await config.email.sendMail({
              to: recipient.email,
              subject,
              template,
              context: {
                ...commonContext,
                name: recipient.name,
                personalData: recipient.personalData
              }
            });

            results.sent.push({
              email: recipient.email,
              messageId: result.messageId
            });

            // Log successful send
            await EmailLog.create({
              to: [recipient.email],
              subject,
              template,
              status: 'sent',
              messageId: result.messageId,
              sentAt: new Date(),
              metadata: {
                jobId: job.id,
                batchIndex: Math.floor(i / batchSize)
              }
            });
          } catch (error) {
            results.failed.push({
              email: recipient.email,
              error: error.message
            });

            // Log failed send
            await EmailLog.create({
              to: [recipient.email],
              subject,
              template,
              status: 'failed',
              error: error.message,
              metadata: {
                jobId: job.id,
                batchIndex: Math.floor(i / batchSize)
              }
            });
          }
        });

        await Promise.all(batchPromises);

        // Update job progress
        await job.progress(Math.round(((i + batch.length) / recipients.length) * 100));
      }

      logger.info(`Bulk email job ${job.id} completed: ${results.sent.length} sent, ${results.failed.length} failed`);
      return results;
    } catch (error) {
      logger.error(`Bulk email job ${job.id} failed:`, error);
      throw error;
    }
  }
};