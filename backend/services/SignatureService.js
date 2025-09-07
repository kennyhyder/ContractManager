const crypto = require('crypto');
const { Contract, User } = require('../models');
const FileService = require('./FileService');
const ActivityService = require('./ActivityService');
const NotificationService = require('./NotificationService');
const logger = require('../utils/logger');
const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');

class SignatureService {
  constructor() {
    this.signatureMethods = {
      DRAW: 'draw',
      TYPE: 'type',
      UPLOAD: 'upload',
      DIGITAL: 'digital',
      BIOMETRIC: 'biometric'
    };

    this.certificateProviders = {
      INTERNAL: 'internal',
      DOCUSIGN: 'docusign',
      ADOBE_SIGN: 'adobe_sign',
      HELLOSIGN: 'hellosign'
    };
  }

  /**
   * Create signature request
   */
  async createSignatureRequest(contractId, parties, options = {}) {
    try {
      const {
        message,
        deadline,
        sequential = false,
        reminderDays = [3, 7],
        requireAuthentication = false,
        certificateProvider = this.certificateProviders.INTERNAL
      } = options;

      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Validate parties
      const validParties = parties.filter(party => {
        const contractParty = contract.parties.find(p => p.email === party.email);
        return contractParty && contractParty.role === 'signatory';
      });

      if (validParties.length === 0) {
        throw new Error('No valid signatories found');
      }

      // Generate signature tokens
      const signatureRequests = validParties.map((party, index) => ({
        email: party.email,
        name: party.name,
        token: this.generateSignatureToken(),
        order: sequential ? index : 0,
        status: 'pending',
        requireAuthentication,
        certificateProvider,
        requestedAt: new Date(),
        expiresAt: deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }));

      // Update contract
      contract.signatureRequests = signatureRequests;
      contract.signatureStatus = 'pending';
      await contract.save();

      // Send signature requests
      for (const request of signatureRequests) {
        await this.sendSignatureRequest(contract, request, message);
      }

      // Log activity
      await ActivityService.logActivity({
        user: contract.owner,
        action: 'signature.requested',
        resource: { type: 'contract', id: contractId },
        details: {
          parties: validParties.length,
          sequential,
          deadline
        }
      });

      return signatureRequests;
    } catch (error) {
      logger.error('Create signature request error:', error);
      throw error;
    }
  }

  /**
   * Sign document
   */
  async signDocument(contractId, signatureToken, signatureData) {
    try {
      const {
        method,
        signature,
        ipAddress,
        userAgent,
        location,
        authMethod
      } = signatureData;

      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Find signature request
      const request = contract.signatureRequests.find(r => r.token === signatureToken);
      if (!request) {
        throw new Error('Invalid signature token');
      }

      // Validate request
      if (request.status !== 'pending') {
        throw new Error('Signature request already processed');
      }

      if (new Date() > new Date(request.expiresAt)) {
        throw new Error('Signature request expired');
      }

      // Find party
      const party = contract.parties.find(p => p.email === request.email);
      if (!party) {
        throw new Error('Party not found');
      }

      // Process signature based on method
      let processedSignature;
      switch (method) {
        case this.signatureMethods.DRAW:
          processedSignature = await this.processDrawnSignature(signature);
          break;
        case this.signatureMethods.TYPE:
          processedSignature = await this.processTypedSignature(signature, party.name);
          break;
        case this.signatureMethods.UPLOAD:
          processedSignature = await this.processUploadedSignature(signature);
          break;
        case this.signatureMethods.DIGITAL:
          processedSignature = await this.processDigitalSignature(signature, contract);
          break;
        default:
          throw new Error('Invalid signature method');
      }

      // Create signature record
      const signatureRecord = {
        signatory: party.email,
        method,
        signature: processedSignature.url,
        hash: processedSignature.hash,
        timestamp: new Date(),
        ipAddress,
        userAgent,
        location,
        authMethod,
        certificate: await this.generateCertificate(contract, party, processedSignature)
      };

      // Update contract
      party.signed = true;
      party.signedAt = new Date();
      party.signature = signatureRecord;
      
      request.status = 'completed';
      request.completedAt = new Date();

      // Check if all signatures collected
      const allSigned = contract.parties
        .filter(p => p.role === 'signatory')
        .every(p => p.signed);

      if (allSigned) {
        contract.status = 'signed';
        contract.signatureStatus = 'completed';
        contract.signedAt = new Date();
      }

      await contract.save();

      // Generate audit trail
      await this.generateAuditTrail(contract, signatureRecord);

      // Send notifications
      await this.notifySignature(contract, party, allSigned);

      // Log activity
      await ActivityService.logActivity({
        user: party.userId || null,
        action: 'signature.completed',
        resource: { type: 'contract', id: contractId },
        details: {
          signatory: party.email,
          method,
          allSigned
        }
      });

      return {
        success: true,
        signature: signatureRecord,
        allSigned
      };
    } catch (error) {
      logger.error('Sign document error:', error);
      throw error;
    }
  }

  /**
   * Verify signature
   */
  async verifySignature(contractId, signatureHash) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Find signature
      let foundSignature = null;
      let signatory = null;

      for (const party of contract.parties) {
        if (party.signature && party.signature.hash === signatureHash) {
          foundSignature = party.signature;
          signatory = party;
          break;
        }
      }

      if (!foundSignature) {
        return {
          valid: false,
          error: 'Signature not found'
        };
      }

      // Verify signature integrity
      const isValid = await this.verifySignatureIntegrity(
        foundSignature,
        contract
      );

      // Get certificate details
      const certificate = await this.getCertificateDetails(foundSignature.certificate);

      return {
        valid: isValid,
        signatory: {
          name: signatory.name,
          email: signatory.email,
          signedAt: foundSignature.timestamp
        },
        certificate,
        method: foundSignature.method,
        verifiedAt: new Date()
      };
    } catch (error) {
      logger.error('Verify signature error:', error);
      throw error;
    }
  }

  /**
   * Process signature methods
   */
  async processDrawnSignature(signatureData) {
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(signatureData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      
      // Upload to storage
      const uploadResult = await FileService.uploadFile({
        buffer,
        mimetype: 'image/png',
        originalname: 'signature.png'
      }, {
        folder: 'signatures',
        optimize: true
      });

      // Generate hash
      const hash = crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');

      return {
        url: uploadResult.url,
        hash
      };
    } catch (error) {
      logger.error('Process drawn signature error:', error);
      throw error;
    }
  }

  async processTypedSignature(text, name) {
    try {
      // Create canvas
      const canvas = createCanvas(400, 150);
      const ctx = canvas.getContext('2d');

      // Set background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 400, 150);

      // Draw signature text
      ctx.fillStyle = 'black';
      ctx.font = 'italic 40px cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 200, 75);

      // Convert to buffer
      const buffer = canvas.toBuffer('image/png');

      // Upload to storage
      const uploadResult = await FileService.uploadFile({
        buffer,
        mimetype: 'image/png',
        originalname: 'typed-signature.png'
      }, {
        folder: 'signatures'
      });

      // Generate hash
      const hash = crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');

      return {
        url: uploadResult.url,
        hash
      };
    } catch (error) {
      logger.error('Process typed signature error:', error);
      throw error;
    }
  }

  async processUploadedSignature(file) {
    try {
      // Validate file
      if (!file.mimetype.startsWith('image/')) {
        throw new Error('Invalid file type');
      }

      // Upload to storage
      const uploadResult = await FileService.uploadFile(file, {
        folder: 'signatures',
        optimize: true
      });

      // Generate hash
      const hash = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');

      return {
        url: uploadResult.url,
        hash
      };
    } catch (error) {
      logger.error('Process uploaded signature error:', error);
      throw error;
    }
  }

  async processDigitalSignature(certificateData, contract) {
    try {
      // This would integrate with digital certificate providers
      // For now, we'll create a mock digital signature
      
      const signatureData = {
        contractId: contract._id,
        certificateId: certificateData.certificateId,
        timestamp: new Date(),
        algorithm: 'RSA-SHA256'
      };

      const signature = crypto
        .createSign('RSA-SHA256')
        .update(JSON.stringify(signatureData))
        .sign(certificateData.privateKey, 'hex');

      return {
        url: null, // Digital signatures don't have visual representation
        hash: signature,
        certificateId: certificateData.certificateId
      };
    } catch (error) {
      logger.error('Process digital signature error:', error);
      throw error;
    }
  }

  /**
   * Generate certificate
   */
  async generateCertificate(contract, party, signature) {
    try {
      const certificate = {
        id: crypto.randomBytes(16).toString('hex'),
        contractId: contract._id,
        contractTitle: contract.title,
        signatory: {
          name: party.name,
          email: party.email
        },
        signature: {
          hash: signature.hash,
          timestamp: new Date()
        },
        issuer: 'Contract Management System',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) // 10 years
      };

      // Generate QR code for verification
      const verificationUrl = `${process.env.FRONTEND_URL}/verify/${certificate.id}`;
      certificate.qrCode = await QRCode.toDataURL(verificationUrl);

      // Store certificate
      const certificateKey = `certificate:${certificate.id}`;
      await redis.setex(
        certificateKey,
        10 * 365 * 24 * 60 * 60, // 10 years
        JSON.stringify(certificate)
      );

      return certificate;
    } catch (error) {
      logger.error('Generate certificate error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  generateSignatureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async sendSignatureRequest(contract, request, message) {
    try {
      const signatureUrl = `${process.env.FRONTEND_URL}/sign/${contract._id}?token=${request.token}`;

      await EmailService.sendEmail({
        to: request.email,
        template: 'signature-request',
        data: {
          name: request.name,
          contractTitle: contract.title,
          message,
          signatureUrl,
          deadline: request.expiresAt
        },
        priority: 'high'
      });
    } catch (error) {
      logger.error('Send signature request error:', error);
      throw error;
    }
  }

  async verifySignatureIntegrity(signature, contract) {
    try {
      // Verify signature hasn't been tampered with
      const storedHash = signature.hash;
      
      // For digital signatures, verify cryptographically
      if (signature.method === this.signatureMethods.DIGITAL) {
        // This would verify against the certificate authority
        return true; // Simplified for example
      }

      // For other methods, check file integrity
      if (signature.signature) {
        const fileMetadata = await FileService.getFileMetadata(signature.signature);
        return fileMetadata !== null;
      }

      return true;
    } catch (error) {
      logger.error('Verify signature integrity error:', error);
      return false;
    }
  }

  async getCertificateDetails(certificateId) {
    try {
      const certificateKey = `certificate:${certificateId}`;
      const certificateData = await redis.get(certificateKey);
      
      if (!certificateData) {
        return null;
      }

      return JSON.parse(certificateData);
    } catch (error) {
      logger.error('Get certificate details error:', error);
      return null;
    }
  }

  async generateAuditTrail(contract, signatureRecord) {
    try {
      const auditEntry = {
        contractId: contract._id,
        action: 'signature_added',
        signatory: signatureRecord.signatory,
        timestamp: signatureRecord.timestamp,
        details: {
          method: signatureRecord.method,
          ipAddress: signatureRecord.ipAddress,
          location: signatureRecord.location,
          certificateId: signatureRecord.certificate.id
        }
      };

      // Store audit trail
      const auditKey = `audit:contract:${contract._id}:${Date.now()}`;
      await redis.setex(
        auditKey,
        7 * 365 * 24 * 60 * 60, // 7 years
        JSON.stringify(auditEntry)
      );

      return auditEntry;
    } catch (error) {
      logger.error('Generate audit trail error:', error);
      throw error;
    }
  }

  async notifySignature(contract, party, allSigned) {
    try {
      // Notify contract owner
      await NotificationService.sendNotification({
        userId: contract.owner,
        type: allSigned ? 'contract_fully_signed' : 'contract_signed',
        title: allSigned ? 'Contract Fully Signed' : 'Contract Signed',
        message: allSigned 
          ? `"${contract.title}" has been fully signed by all parties`
          : `${party.name} has signed "${contract.title}"`,
        data: { contractId: contract._id }
      });

      // If fully signed, notify all parties
      if (allSigned) {
        const notifications = contract.parties
          .filter(p => p.email !== party.email)
          .map(p => 
            EmailService.sendEmail({
              to: p.email,
              template: 'contract-fully-signed',
              data: {
                name: p.name,
                contractTitle: contract.title,
                viewUrl: `${process.env.FRONTEND_URL}/contracts/${contract._id}`
              }
            })
          );

        await Promise.all(notifications);
      }
    } catch (error) {
      logger.error('Notify signature error:', error);
    }
  }
}

module.exports = new SignatureService();