const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Cryptography utilities
 */
class CryptoUtils {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.saltRounds = 10;
    this.ivLength = 16;
    this.tagLength = 16;
    this.saltLength = 32;
    this.iterations = 100000;
    this.keyLength = 32;
    this.digest = 'sha256';
  }

  /**
   * Generate random bytes
   */
  generateRandomBytes(length = 32) {
    return crypto.randomBytes(length);
  }

  /**
   * Generate random string
   */
  generateRandomString(length = 32, encoding = 'hex') {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString(encoding)
      .slice(0, length);
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password) {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify password using bcrypt
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   */
  generateJWT(payload, secret = process.env.JWT_SECRET, options = {}) {
    const defaultOptions = {
      expiresIn: '15m',
      issuer: process.env.JWT_ISSUER || 'contract-management',
      audience: process.env.JWT_AUDIENCE || 'contract-management-users'
    };

    return jwt.sign(payload, secret, { ...defaultOptions, ...options });
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token, secret = process.env.JWT_SECRET, options = {}) {
    const defaultOptions = {
      issuer: process.env.JWT_ISSUER || 'contract-management',
      audience: process.env.JWT_AUDIENCE || 'contract-management-users'
    };

    return jwt.verify(token, secret, { ...defaultOptions, ...options });
  }

  /**
   * Decode JWT token without verification
   */
  decodeJWT(token) {
    return jwt.decode(token, { complete: true });
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(text, password = process.env.ENCRYPTION_KEY) {
    const salt = crypto.randomBytes(this.saltLength);
    const key = crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, this.digest);
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData, password = process.env.ENCRYPTION_KEY) {
    const key = crypto.pbkdf2Sync(
      password,
      Buffer.from(encryptedData.salt, 'hex'),
      this.iterations,
      this.keyLength,
      this.digest
    );
    
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Create hash
   */
  hash(data, algorithm = 'sha256') {
    return crypto
      .createHash(algorithm)
      .update(data)
      .digest('hex');
  }

  /**
   * Create HMAC
   */
  hmac(data, secret = process.env.HMAC_SECRET, algorithm = 'sha256') {
    return crypto
      .createHmac(algorithm, secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC
   */
  verifyHmac(data, signature, secret = process.env.HMAC_SECRET, algorithm = 'sha256') {
    const expectedSignature = this.hmac(data, secret, algorithm);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate key pair
   */
  generateKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  }

  /**
   * Sign data with private key
   */
  sign(data, privateKey, algorithm = 'RSA-SHA256') {
    const sign = crypto.createSign(algorithm);
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'hex');
  }

  /**
   * Verify signature with public key
   */
  verifySignature(data, signature, publicKey, algorithm = 'RSA-SHA256') {
    const verify = crypto.createVerify(algorithm);
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'hex');
  }

  /**
   * Generate secure token
   */
  generateSecureToken(length = 32) {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(length, (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer.toString('base64url'));
      });
    });
  }

  /**
   * Generate OTP
   */
  generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    
    return otp;
  }

  /**
   * Generate API key
   */
  generateApiKey(prefix = 'sk') {
    const timestamp = Date.now().toString(36);
    const randomPart = this.generateRandomString(32);
    return `${prefix}_${timestamp}_${randomPart}`;
  }

  /**
   * Mask sensitive data
   */
  maskData(data, showFirst = 4, showLast = 4) {
    if (!data || data.length <= showFirst + showLast) return data;
    
    const first = data.slice(0, showFirst);
    const last = data.slice(-showLast);
    const masked = '*'.repeat(Math.max(data.length - showFirst - showLast, 4));
    
    return `${first}${masked}${last}`;
  }

  /**
   * Generate checksum
   */
  generateChecksum(data) {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  /**
   * Verify checksum
   */
  verifyChecksum(data, checksum) {
    const expectedChecksum = this.generateChecksum(data);
    return checksum === expectedChecksum;
  }

  /**
   * Encrypt file
   */
  async encryptFile(buffer, password = process.env.ENCRYPTION_KEY) {
    const encrypted = this.encrypt(buffer.toString('base64'), password);
    return Buffer.from(JSON.stringify(encrypted));
  }

  /**
   * Decrypt file
   */
  async decryptFile(encryptedBuffer, password = process.env.ENCRYPTION_KEY) {
    const encryptedData = JSON.parse(encryptedBuffer.toString());
    const decrypted = this.decrypt(encryptedData, password);
    return Buffer.from(decrypted, 'base64');
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken() {
    const token = this.generateRandomString(32);
    const expires = Date.now() + 3600000; // 1 hour
    const hash = this.hash(token);
    
    return {
      token,
      hash,
      expires
    };
  }

  /**
   * Verify password reset token
   */
  verifyPasswordResetToken(token, hash, expires) {
    if (Date.now() > expires) {
      return { valid: false, reason: 'Token expired' };
    }

const expectedHash = this.hash(token);
    if (expectedHash !== hash) {
      return { valid: false, reason: 'Invalid token' };
    }
    
    return { valid: true };
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `sess_${Date.now()}_${this.generateRandomString(24)}`;
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken() {
    return this.generateRandomString(32);
  }

  /**
   * Verify CSRF token
   */
  verifyCSRFToken(token, sessionToken) {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(sessionToken)
    );
  }
}

// Export singleton instance
module.exports = new CryptoUtils();