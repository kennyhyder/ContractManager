const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Token generation utilities
 */
class TokenGenerator {
  /**
   * Generate access token
   */
  generateAccessToken(payload, options = {}) {
    const defaultOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: process.env.JWT_ISSUER || 'contract-management',
      audience: process.env.JWT_AUDIENCE || 'contract-management-users',
      algorithm: 'HS256'
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { ...defaultOptions, ...options }
    );
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload, options = {}) {
    const defaultOptions = {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'contract-management',
      audience: process.env.JWT_AUDIENCE || 'contract-management-users',
      algorithm: 'HS256'
    };

    return jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET,
      { ...defaultOptions, ...options }
    );
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken() {
    return {
      token: crypto.randomBytes(32).toString('hex'),
      expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    return {
      token,
      hash,
      expires: Date.now() + 60 * 60 * 1000 // 1 hour
    };
  }

  /**
   * Generate API key
   */
  generateApiKey(prefix = 'sk') {
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_${timestamp}_${randomPart}`;
  }

  /**
   * Generate session token
   */
  generateSessionToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate OTP (One Time Password)
   */
  generateOTP(length = 6, options = {}) {
    const {
      type = 'numeric', // numeric, alphanumeric, alphabetic
      expires = 5 * 60 * 1000 // 5 minutes
    } = options;

    let characters;
    switch (type) {
      case 'numeric':
        characters = '0123456789';
        break;
      case 'alphabetic':
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        break;
      case 'alphanumeric':
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        break;
      default:
        characters = '0123456789';
    }

    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return {
      code: otp,
      expires: Date.now() + expires
    };
  }

  /**
   * Generate invite token
   */
  generateInviteToken(email, role = 'user') {
    const payload = {
      email,
      role,
      type: 'invite'
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
        issuer: process.env.JWT_ISSUER || 'contract-management'
      }
    );
  }

  /**
   * Generate magic link token
   */
  generateMagicLinkToken(userId, email) {
    const payload = {
      userId,
      email,
      type: 'magic_link',
      nonce: crypto.randomBytes(16).toString('hex')
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: '15m',
        issuer: process.env.JWT_ISSUER || 'contract-management'
      }
    );
  }

  /**
   * Generate webhook signing secret
   */
  generateWebhookSecret() {
    return `whsec_${crypto.randomBytes(32).toString('base64url')}`;
  }

  /**
   * Generate contract access token
   */
  generateContractAccessToken(contractId, permissions = ['read']) {
    const payload = {
      contractId,
      permissions,
      type: 'contract_access'
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: '24h',
        issuer: process.env.JWT_ISSUER || 'contract-management'
      }
    );
  }

  /**
   * Generate download token
   */
  generateDownloadToken(resourceId, resourceType = 'contract') {
    const payload = {
      resourceId,
      resourceType,
      type: 'download',
      nonce: crypto.randomBytes(16).toString('hex')
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: '1h',
        issuer: process.env.JWT_ISSUER || 'contract-management'
      }
    );
  }

  /**
   * Verify token
   */
  verifyToken(token, secret = process.env.JWT_SECRET, options = {}) {
    try {
      return jwt.verify(token, secret, options);
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  /**
   * Decode token without verification
   */
  decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }

  /**
   * Generate signature request token
   */
  generateSignatureToken(contractId, partyEmail) {
    const payload = {
      contractId,
      partyEmail,
      type: 'signature_request',
      nonce: crypto.randomBytes(16).toString('hex')
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: '30d',
        issuer: process.env.JWT_ISSUER || 'contract-management'
      }
    );
  }

  /**
   * Generate approval token
   */
  generateApprovalToken(approvalId, approverId) {
    const payload = {
      approvalId,
      approverId,
      type: 'approval',
      nonce: crypto.randomBytes(16).toString('hex')
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
        issuer: process.env.JWT_ISSUER || 'contract-management'
      }
    );
  }

  /**
   * Generate integration token
   */
  generateIntegrationToken(userId, integration) {
    const payload = {
      userId,
      integration,
      type: 'integration',
      nonce: crypto.randomBytes(16).toString('hex')
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: '1h',
        issuer: process.env.JWT_ISSUER || 'contract-management'
      }
    );
  }

  /**
   * Generate state parameter for OAuth
   */
  generateOAuthState(data = {}) {
    const state = {
      ...data,
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now()
    };

    return Buffer.from(JSON.stringify(state)).toString('base64url');
  }

  /**
   * Verify OAuth state
   */
  verifyOAuthState(state, maxAge = 10 * 60 * 1000) { // 10 minutes
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      
      if (Date.now() - decoded.timestamp > maxAge) {
        throw new Error('State expired');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Invalid state: ${error.message}`);
    }
  }
}

module.exports = new TokenGenerator();