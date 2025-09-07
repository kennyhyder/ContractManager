const AuthService = require('../services/AuthService');
const UserService = require('../services/UserService');
const ActivityService = require('../services/ActivityService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

class AuthController {
  /**
   * Register new user
   */
  async register(req, res, next) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password, firstName, lastName, company } = req.body;

      // Register user
      const result = await AuthService.register({
        email,
        password,
        firstName,
        lastName,
        company
      });

      // Set refresh token cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          user: result.user,
          accessToken: result.accessToken
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      
      if (error.message === 'Email already registered') {
        return res.status(409).json({
          error: 'Email already registered',
          code: 'EMAIL_EXISTS'
        });
      }
      
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password, rememberMe } = req.body;
      const ipAddress = req.ip;

      // Attempt login
      const result = await AuthService.login(email, password, ipAddress);

      // Set refresh token cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      };

      if (rememberMe) {
        cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      } else {
        cookieOptions.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      }

      res.cookie('refreshToken', result.refreshToken, cookieOptions);

      // Check if 2FA is required
      if (result.requires2FA) {
        return res.json({
          success: true,
          requires2FA: true,
          message: 'Please enter your 2FA code'
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      
      if (error.message.includes('Invalid credentials')) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      if (error.message.includes('locked')) {
        return res.status(423).json({
          error: error.message,
          code: 'ACCOUNT_LOCKED'
        });
      }
      
      if (error.message.includes('verify your email')) {
        return res.status(403).json({
          error: error.message,
          code: 'EMAIL_NOT_VERIFIED'
        });
      }
      
      next(error);
    }
  }

  /**
   * Verify 2FA code
   */
  async verify2FA(req, res, next) {
    try {
      const { code } = req.body;
      const userId = req.user._id; // From session or temporary token

      const result = await AuthService.verify2FA(userId, code);

      if (!result.verified) {
        return res.status(401).json({
          error: 'Invalid 2FA code',
          code: 'INVALID_2FA'
        });
      }

      // Generate new tokens after 2FA verification
      const tokens = AuthService.generateTokens(req.user);

      res.json({
        success: true,
        message: '2FA verification successful',
        data: {
          user: req.user,
          accessToken: tokens.accessToken
        }
      });
    } catch (error) {
      logger.error('2FA verification error:', error);
      next(error);
    }
  }

  /**
   * Enable 2FA
   */
  async enable2FA(req, res, next) {
    try {
      const userId = req.user._id;

      const result = await AuthService.enable2FA(userId);

      res.json({
        success: true,
        message: '2FA setup initiated',
        data: {
          secret: result.secret,
          qrCode: result.qrCode
        }
      });
    } catch (error) {
      logger.error('Enable 2FA error:', error);
      next(error);
    }
  }

  /**
   * Confirm 2FA setup
   */
  async confirm2FA(req, res, next) {
    try {
      const { code } = req.body;
      const userId = req.user._id;

      const result = await AuthService.confirm2FA(userId, code);

      res.json({
        success: true,
        message: '2FA enabled successfully',
        data: {
          backupCodes: result.backupCodes
        }
      });
    } catch (error) {
      logger.error('Confirm 2FA error:', error);
      
      if (error.message === 'Invalid code') {
        return res.status(400).json({
          error: 'Invalid verification code',
          code: 'INVALID_CODE'
        });
      }
      
      next(error);
    }
  }

  /**
   * Disable 2FA
   */
  async disable2FA(req, res, next) {
    try {
      const { password } = req.body;
      const userId = req.user._id;

      // Verify password first
      const user = await User.findById(userId).select('+password');
      const isValid = await bcrypt.compare(password, user.password);
      
      if (!isValid) {
        return res.status(401).json({
          error: 'Invalid password',
          code: 'INVALID_PASSWORD'
        });
      }

      // Disable 2FA
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      user.twoFactorBackupCodes = undefined;
      await user.save();

      res.json({
        success: true,
        message: '2FA disabled successfully'
      });
    } catch (error) {
      logger.error('Disable 2FA error:', error);
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.cookies;

      if (!refreshToken) {
        return res.status(401).json({
          error: 'Refresh token not provided',
          code: 'NO_REFRESH_TOKEN'
        });
      }

      const result = await AuthService.refreshToken(refreshToken);

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken
        }
      });
    } catch (error) {
      logger.error('Refresh token error:', error);
      
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }
      
      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(req, res, next) {
    try {
      const userId = req.user._id;
      const { refreshToken } = req.cookies;

      if (refreshToken) {
        await AuthService.logout(userId, refreshToken);
      }

      // Clear cookies
      res.clearCookie('refreshToken');
      res.clearCookie('sessionId');

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      // Don't fail logout
      res.json({
        success: true,
        message: 'Logout successful'
      });
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      await AuthService.requestPasswordReset(email);

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    } catch (error) {
      logger.error('Forgot password error:', error);
      // Don't expose errors
      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;

      await AuthService.resetPassword(token, password);

      res.json({
        success: true,
        message: 'Password reset successful. You can now login with your new password.'
      });
    } catch (error) {
      logger.error('Reset password error:', error);
      
      if (error.message.includes('Invalid or expired')) {
        return res.status(400).json({
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        });
      }
      
      next(error);
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.params;

      const user = await User.findOne({ 
        verificationToken: token,
        emailVerified: false 
      });

      if (!user) {
        return res.status(400).json({
          error: 'Invalid or expired verification token',
          code: 'INVALID_TOKEN'
        });
      }

      // Verify email
      user.emailVerified = true;
      user.verificationToken = undefined;
      user.verifiedAt = new Date();
      await user.save();

      // Log activity
      await ActivityService.logActivity({
        user: user._id,
        action: 'user.email_verified',
        resource: { type: 'user', id: user._id }
      });

      res.json({
        success: true,
        message: 'Email verified successfully. You can now login.'
      });
    } catch (error) {
      logger.error('Verify email error:', error);
      next(error);
    }
  }

  /**
   * Resend verification email
   */
  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email, emailVerified: false });
      
      if (!user) {
        // Don't reveal if user exists
        return res.json({
          success: true,
          message: 'If an unverified account exists, a verification email has been sent.'
        });
      }

      // Generate new token
      user.verificationToken = crypto.randomBytes(32).toString('hex');
      await user.save();

      // Send email
      await EmailService.sendEmail({
        to: user.email,
        template: 'email-verification',
        data: {
          firstName: user.firstName,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${user.verificationToken}`
        }
      });

      res.json({
        success: true,
        message: 'If an unverified account exists, a verification email has been sent.'
      });
    } catch (error) {
      logger.error('Resend verification error:', error);
      next(error);
    }
  }

  /**
   * Change password
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user._id;

      await UserService.changePassword(userId, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change password error:', error);
      
      if (error.message.includes('incorrect')) {
        return res.status(401).json({
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD'
        });
      }
      
      next(error);
    }
  }

  /**
   * Get sessions
   */
  async getSessions(req, res, next) {
    try {
      const userId = req.user._id;
      
      // Get active sessions from Redis
      const sessions = await AuthService.getUserSessions(userId);

      res.json({
        success: true,
        data: sessions
      });
    } catch (error) {
      logger.error('Get sessions error:', error);
      next(error);
    }
  }

  /**
   * Revoke session
   */
  async revokeSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const userId = req.user._id;

      await AuthService.revokeSession(userId, sessionId);

      res.json({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (error) {
      logger.error('Revoke session error:', error);
      next(error);
    }
  }
}

module.exports = new AuthController();