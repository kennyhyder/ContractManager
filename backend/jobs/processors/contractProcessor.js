const Contract = require('../../models/Contract');
const Activity = require('../../models/Activity');
const jobManager = require('../index');
const logger = require('../../utils/logger');
const PDFGenerator = require('../../services/pdfGenerator');
const ArchiveService = require('../../services/archiveService');
const moment = require('moment');

module.exports = {
  async checkExpiry(job) {
    try {
      logger.info('Checking for expiring contracts...');

      const expiryThresholds = [30, 14, 7, 1]; // Days before expiry
      const now = new Date();
      let notificationCount = 0;

      for (const days of expiryThresholds) {
        const targetDate = moment().add(days, 'days').startOf('day').toDate();
        const endOfDay = moment().add(days, 'days').endOf('day').toDate();

        // Find contracts expiring on this day
        const expiringContracts = await Contract.find({
          status: 'active',
          endDate: {
            $gte: targetDate,
            $lte: endOfDay
          },
          [`notifications.${days}DayWarning`]: { $ne: true }
        }).populate('owner collaborators');

        for (const contract of expiringContracts) {
          // Send notifications
          const recipients = [contract.owner, ...contract.collaborators];
          
          for (const recipient of recipients) {
            await jobManager.addNotificationJob({
              type: 'contract-expiring',
              recipient: recipient._id,
              data: {
                contractId: contract._id,
                contractTitle: contract.title,
                daysUntilExpiry: days,
                expiryDate: contract.endDate
              }
            });

            await jobManager.addEmailJob('send-email', {
              to: recipient.email,
              subject: `Contract Expiring in ${days} Days: ${contract.title}`,
              template: 'contract-expiring',
              context: {
                recipientName: recipient.name,
                contractTitle: contract.title,
                daysUntilExpiry: days,
                expiryDate: moment(contract.endDate).format('MMMM Do YYYY'),
                contractUrl: `${process.env.FRONTEND_URL}/contracts/${contract._id}`
              }
            });
          }

          // Mark notification as sent
          contract.notifications[`${days}DayWarning`] = true;
          await contract.save();

          notificationCount++;

          // Log activity
          await Activity.create({
            action: 'contract.expiry-warning',
            resource: 'Contract',
            resourceId: contract._id,
            metadata: {
              daysUntilExpiry: days,
              recipientCount: recipients.length
            }
          });
        }
      }

      // Check for already expired contracts
      const expiredContracts = await Contract.find({
        status: 'active',
        endDate: { $lt: now }
      });

      for (const contract of expiredContracts) {
        contract.status = 'expired';
        await contract.save();

        await Activity.create({
          action: 'contract.expired',
          resource: 'Contract',
          resourceId: contract._id
        });
      }

      logger.info(`Contract expiry check completed. Sent ${notificationCount} notifications, marked ${expiredContracts.length} as expired.`);
      return { notificationCount, expiredCount: expiredContracts.length };
    } catch (error) {
      logger.error('Contract expiry check failed:', error);
      throw error;
    }
  },

  async generatePDF(job) {
    const { contractId, options = {} } = job.data;

    try {
      logger.info(`Generating PDF for contract ${contractId}`);

      const contract = await Contract.findById(contractId)
        .populate('owner', 'name email company')
        .populate('collaborators', 'name email')
        .populate('template', 'name category');

      if (!contract) {
        throw new Error('Contract not found');
      }

      // Generate PDF
      const pdfGenerator = new PDFGenerator();
      const pdfBuffer = await pdfGenerator.generateContract(contract, options);

      // Save PDF reference
      const pdfUrl = await config.aws.uploadFile(
        {
          buffer: pdfBuffer,
          originalname: `${contract.title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
          mimetype: 'application/pdf'
        },
        {
          folder: `contracts/${contractId}/exports`,
          metadata: {
            contractId: contractId,
            generatedAt: new Date().toISOString()
          }
        }
      );

      // Update contract with PDF URL
      contract.exports.push({
        type: 'pdf',
        url: pdfUrl.location,
        key: pdfUrl.key,
        generatedAt: new Date(),
        generatedBy: options.userId,
        options: options
      });
      await contract.save();

      // Log activity
      await Activity.create({
        user: options.userId,
        action: 'contract.exported',
        resource: 'Contract',
        resourceId: contractId,
        metadata: {
          exportType: 'pdf',
          fileSize: pdfBuffer.length
        }
      });

      logger.info(`PDF generated successfully for contract ${contractId}`);
      return pdfUrl;
    } catch (error) {
      logger.error(`PDF generation failed for contract ${contractId}:`, error);
      throw error;
    }
  },

  async processSignature(job) {
    const { contractId, signatureData, userId } = job.data;

    try {
      logger.info(`Processing signature for contract ${contractId}`);

      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Verify signature
      const isValid = await contract.verifySignature(signatureData, userId);
      if (!isValid) {
        throw new Error('Invalid signature');
      }

      // Add signature to contract
      contract.signatures.push({
        user: userId,
        signature: signatureData.signature,
        signedAt: new Date(),
        ipAddress: signatureData.ipAddress,
        userAgent: signatureData.userAgent,
        certificateId: signatureData.certificateId
      });

      // Update status if all required signatures are collected
      if (contract.isFullySigned()) {
        contract.status = 'signed';
        contract.signedDate = new Date();

        // Send completion notifications
        const participants = await contract.populate('owner collaborators');
        for (const participant of [participants.owner, ...participants.collaborators]) {
          await jobManager.addNotificationJob({
            type: 'contract-signed',
            recipient: participant._id,
            data: {
              contractId: contract._id,
              contractTitle: contract.title
            }
          });
        }
      }

      await contract.save();

      // Generate certificate
      if (contract.status === 'signed') {
        await jobManager.addContractJob('generate-certificate', {
          contractId: contract._id
        });
      }

      // Log activity
      await Activity.create({
        user: userId,
        action: 'contract.signed',
        resource: 'Contract',
        resourceId: contractId,
        metadata: {
          signatureMethod: signatureData.method,
          fullyigned: contract.status === 'signed'
        }
      });

      logger.info(`Signature processed successfully for contract ${contractId}`);
      return { success: true, fullyigned: contract.status === 'signed' };
    } catch (error) {
      logger.error(`Signature processing failed for contract ${contractId}:`, error);
      throw error;
    }
  },

  async archiveContract(job) {
    const { contractId, reason, userId } = job.data;

    try {
      logger.info(`Archiving contract ${contractId}`);

      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Create archive
      const archiveService = new ArchiveService();
      const archiveResult = await archiveService.archiveContract(contract);

      // Update contract status
      contract.status = 'archived';
      contract.archivedAt = new Date();
      contract.archivedBy = userId;
      contract.archiveReason = reason;
      contract.archiveLocation = archiveResult.location;
      await contract.save();

      // Clean up old files if configured
      if (job.data.cleanupFiles) {
        const attachmentKeys = contract.attachments.map(a => a.key);
        await config.aws.deleteFiles(attachmentKeys);
      }

      // Log activity
      await Activity.create({
        user: userId,
        action: 'contract.archived',
        resource: 'Contract',
        resourceId: contractId,
        metadata: {
          reason,
          archiveSize: archiveResult.size,
          filesRemoved: job.data.cleanupFiles
        }
      });

      logger.info(`Contract ${contractId} archived successfully`);
      return archiveResult;
    } catch (error) {
      logger.error(`Contract archiving failed for ${contractId}:`, error);
      throw error;
    }
  }
};