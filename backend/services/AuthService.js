const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { User } = require('../models');
const EmailService = require('./EmailService');
const { redis } = require('../middleware/cache');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Register new user
   */
  async register(userData) {
    try {
      // Check if user exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const user = new User({
        ...userData,
        password: hashedPassword,
        verificationToken: crypto.randomBytes(32).toString('hex')
      });

      await user.save();

      // Send verification email
      await EmailService.sendEmail({
        to: user.email,
        template: 'email-verification',
        data: {
          firstName: user.firstName,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${user.verificationToken}`
        }
      });

      // Generate tokens
      const tokens = this.generateTokens(user);

      return {
        user: user.toJSON(),
        ...tokens
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email, password, ipAddress) {
    try {
      // Find user
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        // Log failed attempt
        user.failedLoginAttempts++;
        user.lastFailedLogin = new Date();
        
        if (user.failedLoginAttempts >= 5) {
          user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        }
        
        await user.save();
        throw new Error('Invalid credentials');
      }

      // Check if account is locked
      if (user.isLocked()) {
        throw new Error('Account is locked. Please try again later.');
      }

      // Check if email is verified
      if (!user.emailVerified) {
        throw new Error('Please verify your email before logging in');
      }

      // Reset failed attempts
      user.failedLoginAttempts = 0;
      user.lastLogin = new Date();
      user.lastLoginIp = ipAddress;
      await user.save();

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Create session
      await this.createSession(user._id, tokens.refreshToken, ipAddress);

      return {
        user: user.toJSON(),
        ...tokens,
        requires2FA: user.twoFactorEnabled && !user.twoFactorVerified
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Verify 2FA code
   */
  async verify2FA(userId, code) {
    try {
      const user = await User.findById(userId).select('+twoFactorSecret');
      
      if (!user || !user.twoFactorEnabled) {
        throw new Error('2FA not enabled');
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2
      });

      if (!verified) {
        throw new Error('Invalid 2FA code');
      }

      // Mark as verified for this session
      user.twoFactorVerified = true;
      await user.save();

      return { verified: true };
    } catch (error) {
      logger.error('2FA verification error:', error);
      throw error;
    }
  }

  /**
   * Enable 2FA
   */
  async enable2FA(userId) {
    try {
      const user = await User.findById(userId);
      
      if (user.twoFactorEnabled) {
        throw new Error('2FA already enabled');
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Contract Management (${user.email})`,
        issuer: 'Contract Management System'
      });

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      // Save secret temporarily
      await redis.setex(
        `2fa:setup:${userId}`,
        300, // 5 minutes
        JSON.stringify({ secret: secret.base32 })
      );

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl
      };
    } catch (error) {
      logger.error('Enable 2FA error:', error);
      throw error;
    }
  }

  /**
   * Confirm 2FA setup
   */
  async confirm2FA(userId, code) {
    try {
      // Get temporary secret
      const setupData = await redis.get(`2fa:setup:${userId}`);
      if (!setupData) {
        throw new Error('2FA setup expired');
      }

      const { secret } = JSON.parse(setupData);

      // Verify code
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 2
      });

      if (!verified) {
        throw new Error('Invalid code');
      }

      // Save to user
      const user = await User.findById(userId);
      user.twoFactorSecret = secret;
      user.twoFactorEnabled = true;
      await user.save();

      // Clean up temporary data
      await redis.del(`2fa:setup:${userId}`);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      user.twoFactorBackupCodes = backupCodes.map(code => 
        bcrypt.hashSync(code, 10)
      );
      await user.save();

      return {
        success: true,
        backupCodes
      };
    } catch (error) {
      logger.error('Confirm 2FA error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Check if session exists
      const session = await redis.get(`session:${decoded.userId}:${decoded.sessionId}`);
      if (!session) {
        throw new Error('Invalid session');
      }

      // Get user
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('Invalid user');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      return { accessToken };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId, refreshToken) {
    try {
      // Decode token to get session ID
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Remove session
      await redis.del(`session:${userId}:${decoded.sessionId}`);

      return { success: true };
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if user exists
        return { success: true };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Save token
      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      // Send email
      await EmailService.sendEmail({
        to: user.email,
        template: 'password-reset',
        data: {
          firstName: user.firstName,
          resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
        },
        priority: 'high'
      });

      return { success: true };
    } catch (error) {
      logger.error('Password reset request error:', error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    try {
      // Hash token
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find user
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Update password
      user.password = await bcrypt.hash(newPassword, 10);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.passwordChangedAt = new Date();
      await user.save();

      // Send confirmation email
      await EmailService.sendEmail({
        to: user.email,
        template: 'password-changed',
        data: {
          firstName: user.firstName
        }
      });

      return { success: true };
    } catch (error) {
      logger.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Generate JWT tokens
   */
  generateTokens(user) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    const accessToken = this.generateAccessToken(user);
    
    const refreshToken = jwt.sign(
      { 
        userId: user._id,
        sessionId
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken, sessionId };
  }

  /**
   * Generate access token
   */
  generateAccessToken(user) {
    return jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  /**
   * Create session
   */
  async createSession(userId, refreshToken, ipAddress) {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const sessionData = {
      userId,
      refreshToken,
      ipAddress,
      userAgent: '',
      createdAt: new Date()
    };

    await redis.setex(
      `session:${userId}:${decoded.sessionId}`,
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify(sessionData)
    );
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }
}

module.exports = new AuthService();