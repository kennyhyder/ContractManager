const axios = require('axios');
const { User, Contract } = require('../models');
const ActivityService = require('./ActivityService');
const logger = require('../utils/logger');
const crypto = require('crypto');

class IntegrationService {
  constructor() {
    this.integrations = {
      SALESFORCE: {
        id: 'salesforce',
        name: 'Salesforce',
        category: 'crm',
        authType: 'oauth2',
        baseUrl: process.env.SALESFORCE_BASE_URL,
        clientId: process.env.SALESFORCE_CLIENT_ID,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
        scopes: ['api', 'refresh_token', 'offline_access']
      },
      HUBSPOT: {
        id: 'hubspot',
        name: 'HubSpot',
        category: 'crm',
        authType: 'oauth2',
        baseUrl: 'https://api.hubapi.com',
        clientId: process.env.HUBSPOT_CLIENT_ID,
        clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
        scopes: ['contacts', 'content', 'forms']
      },
      SLACK: {
        id: 'slack',
        name: 'Slack',
        category: 'communication',
        authType: 'oauth2',
        baseUrl: 'https://slack.com/api',
        clientId: process.env.SLACK_CLIENT_ID,
        clientSecret: process.env.SLACK_CLIENT_SECRET,
        scopes: ['chat:write', 'channels:read', 'users:read']
      },
      GOOGLE_DRIVE: {
        id: 'google_drive',
        name: 'Google Drive',
        category: 'storage',
        authType: 'oauth2',
        baseUrl: 'https://www.googleapis.com/drive/v3',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scopes: ['https://www.googleapis.com/auth/drive.file']
      },
      DOCUSIGN: {
        id: 'docusign',
        name: 'DocuSign',
        category: 'signature',
        authType: 'oauth2',
        baseUrl: process.env.DOCUSIGN_BASE_URL,
        clientId: process.env.DOCUSIGN_CLIENT_ID,
        clientSecret: process.env.DOCUSIGN_CLIENT_SECRET,
        scopes: ['signature', 'impersonation']
      },
      ZAPIER: {
        id: 'zapier',
        name: 'Zapier',
        category: 'automation',
        authType: 'webhook',
        webhookUrl: null
      }
    };
  }

  /**
   * Get available integrations
   */
  getAvailableIntegrations(category) {
    const integrations = Object.values(this.integrations);
    
    if (category) {
      return integrations.filter(i => i.category === category);
    }
    
    return integrations;
  }

  /**
   * Connect integration
   */
  async connectIntegration(userId, integrationId, authData) {
    try {
      const integration = this.integrations[integrationId.toUpperCase()];
      if (!integration) {
        throw new Error('Invalid integration');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Initialize integrations object if not exists
      if (!user.integrations) {
        user.integrations = {};
      }

      // Store encrypted credentials
      const encryptedData = this.encryptCredentials(authData);
      
      user.integrations[integrationId] = {
        connected: true,
        connectedAt: new Date(),
        authType: integration.authType,
        credentials: encryptedData,
        settings: {}
      };

      await user.save();

      // Test connection
      const testResult = await this.testConnection(userId, integrationId);

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'integration.connected',
        resource: { type: 'integration', id: integrationId },
        details: {
          integration: integration.name,
          success: testResult.success
        }
      });

      return {
        success: true,
        integration: integration.name,
        testResult
      };
    } catch (error) {
      logger.error('Connect integration error:', error);
      throw error;
    }
  }

  /**
   * Disconnect integration
   */
  async disconnectIntegration(userId, integrationId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.integrations?.[integrationId]) {
        throw new Error('Integration not connected');
      }

      // Revoke access if OAuth
      const integration = this.integrations[integrationId.toUpperCase()];
      if (integration.authType === 'oauth2') {
        await this.revokeOAuthAccess(user, integrationId);
      }

      // Remove integration
      delete user.integrations[integrationId];
      await user.save();

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'integration.disconnected',
        resource: { type: 'integration', id: integrationId },
        details: {
          integration: integration.name
        }
      });

      return { success: true };
    } catch (error) {
      logger.error('Disconnect integration error:', error);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection(userId, integrationId) {
    try {
      const user = await User.findById(userId);
      const integration = this.integrations[integrationId.toUpperCase()];
      const userIntegration = user.integrations?.[integrationId];

      if (!userIntegration) {
        throw new Error('Integration not connected');
      }

      const credentials = this.decryptCredentials(userIntegration.credentials);

      switch (integrationId) {
        case 'salesforce':
          return await this.testSalesforceConnection(credentials);
        case 'hubspot':
          return await this.testHubSpotConnection(credentials);
        case 'slack':
          return await this.testSlackConnection(credentials);
        case 'google_drive':
          return await this.testGoogleDriveConnection(credentials);
        case 'docusign':
          return await this.testDocuSignConnection(credentials);
        default:
          return { success: true };
      }
    } catch (error) {
      logger.error('Test connection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync contract to CRM
   */
  async syncContractToCRM(contractId, userId, crmType) {
    try {
      const contract = await Contract.findById(contractId)
        .populate('owner')
        .populate('parties');

      if (!contract) {
        throw new Error('Contract not found');
      }

      const user = await User.findById(userId);
      const integration = user.integrations?.[crmType];
      
      if (!integration) {
        throw new Error(`${crmType} not connected`);
      }

      const credentials = this.decryptCredentials(integration.credentials);
      let result;

      switch (crmType) {
        case 'salesforce':
          result = await this.syncToSalesforce(contract, credentials);
          break;
        case 'hubspot':
          result = await this.syncToHubSpot(contract, credentials);
          break;
        default:
          throw new Error('CRM sync not supported');
      }

      // Update contract with CRM ID
      contract.integrations = contract.integrations || {};
      contract.integrations[crmType] = {
        syncedAt: new Date(),
        externalId: result.id,
        lastSync: new Date()
      };
      await contract.save();

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'integration.sync',
        resource: { type: 'contract', id: contractId },
        details: {
          integration: crmType,
          externalId: result.id
        }
      });

      return result;
    } catch (error) {
      logger.error('Sync contract to CRM error:', error);
      throw error;
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(userId, channel, message, options = {}) {
    try {
      const user = await User.findById(userId);
      const integration = user.integrations?.slack;
      
      if (!integration) {
        throw new Error('Slack not connected');
      }

      const credentials = this.decryptCredentials(integration.credentials);
      
      const response = await axios.post('https://slack.com/api/chat.postMessage', {
        channel,
        text: message,
        ...options
      }, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data;
    } catch (error) {
      logger.error('Send Slack notification error:', error);
      throw error;
    }
  }

  /**
   * Upload to cloud storage
   */
  async uploadToCloudStorage(userId, storageType, file, options = {}) {
    try {
      const user = await User.findById(userId);
      const integration = user.integrations?.[storageType];
      
      if (!integration) {
        throw new Error(`${storageType} not connected`);
      }

      const credentials = this.decryptCredentials(integration.credentials);

      switch (storageType) {
        case 'google_drive':
          return await this.uploadToGoogleDrive(file, credentials, options);
        case 'dropbox':
          return await this.uploadToDropbox(file, credentials, options);
        default:
          throw new Error('Storage provider not supported');
      }
    } catch (error) {
      logger.error('Upload to cloud storage error:', error);
      throw error;
    }
  }

  /**
   * Create webhook
   */
  async createWebhook(userId, integrationId, events, callbackUrl) {
    try {
      const integration = this.integrations[integrationId.toUpperCase()];
      if (!integration || integration.authType !== 'webhook') {
        throw new Error('Webhook not supported for this integration');
      }

      const webhookId = crypto.randomBytes(16).toString('hex');
      const webhookSecret = crypto.randomBytes(32).toString('hex');

      // Store webhook configuration
      const user = await User.findById(userId);
      user.integrations = user.integrations || {};
      user.integrations[integrationId] = {
        connected: true,
        authType: 'webhook',
        webhook: {
          id: webhookId,
          secret: webhookSecret,
          events,
          callbackUrl,
          createdAt: new Date()
        }
      };
      await user.save();

      return {
        webhookId,
        webhookUrl: `${process.env.API_URL}/webhooks/${integrationId}/${webhookId}`,
        secret: webhookSecret
      };
    } catch (error) {
      logger.error('Create webhook error:', error);
      throw error;
    }
  }

  /**
   * Integration-specific methods
   */

  async testSalesforceConnection(credentials) {
    try {
      const response = await axios.get(`${credentials.instanceUrl}/services/data/v52.0/`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`
        }
      });
      return { success: true, version: response.data[0].version };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testHubSpotConnection(credentials) {
    try {
      const response = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`
        },
        params: { limit: 1 }
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testSlackConnection(credentials) {
    try {
      const response = await axios.get('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`
        }
      });
      return { success: response.data.ok, team: response.data.team };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testGoogleDriveConnection(credentials) {
    try {
      const response = await axios.get('https://www.googleapis.com/drive/v3/about', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`
        },
        params: { fields: 'user' }
      });
      return { success: true, user: response.data.user.emailAddress };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testDocuSignConnection(credentials) {
    try {
      const response = await axios.get(`${process.env.DOCUSIGN_BASE_URL}/restapi/v2.1/accounts`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`
        }
      });
      return { success: true, accounts: response.data.accounts.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async syncToSalesforce(contract, credentials) {
    // Implementation for Salesforce sync
    logger.info('Syncing to Salesforce:', contract._id);
    return { id: 'SF-' + Date.now() };
  }

  async syncToHubSpot(contract, credentials) {
    // Implementation for HubSpot sync
    logger.info('Syncing to HubSpot:', contract._id);
    return { id: 'HS-' + Date.now() };
  }

  async uploadToGoogleDrive(file, credentials, options) {
    // Implementation for Google Drive upload
    logger.info('Uploading to Google Drive');
    return { id: 'GD-' + Date.now() };
  }

  async uploadToDropbox(file, credentials, options) {
    // Implementation for Dropbox upload
    logger.info('Uploading to Dropbox');
    return { id: 'DB-' + Date.now() };
  }

  /**
   * Encryption helpers
   */

  encryptCredentials(data) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decryptCredentials(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  async revokeOAuthAccess(user, integrationId) {
    // Implementation depends on the specific OAuth provider
    logger.info(`Revoking OAuth access for ${integrationId}`);
  }
}

module.exports = new IntegrationService();