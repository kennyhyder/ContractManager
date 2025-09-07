const express = require('express');
const router = express.Router();
const { User, Activity } = require('../models');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { validateUser } = require('../middleware/validation');
const { uploadMiddleware } = require('../middleware/upload');
const logger = require('../utils/logger');

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      company,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Build query
    const query = { deletedAt: null };

    if (search) {
      query.$text = { $search: search };
    }

    if (role) query.role = role;
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'verified') query.isVerified = true;
    if (status === 'unverified') query.isVerified = false;
    if (company) query.company = new RegExp(company, 'i');

    // Execute query
    const users = await User
      .find(query)
      .select('-password -sessions -apiKeys')
      .populate('organization', 'name')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch users' 
    });
  }
});

/**
 * @route   GET /api/users/search
 * @desc    Search users
 * @access  Private
 */
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: { users: [] }
      });
    }

    const users = await User.search(q, { limit: parseInt(limit) });

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    logger.error('Search users error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to search users' 
    });
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User
      .findById(req.params.id)
      .select('-password -sessions -apiKeys')
      .populate('organization', 'name logo');

    if (!user || user.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Only admins can view other users' full details
    if (!req.user._id.equals(user._id) && req.user.role !== 'admin') {
      // Return limited info
      return res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName,
            avatar: user.profile.avatar,
            title: user.profile.title,
            company: user.company
          }
        }
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch user' 
    });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user (admin only)
 * @access  Private/Admin
 */
router.put('/:id', authMiddleware, adminMiddleware, validateUser.update, async (req, res) => {
  try {
    const updates = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      role: req.body.role,
      isActive: req.body.isActive,
      isVerified: req.body.isVerified,
      company: req.body.company,
      'subscription.plan': req.body.subscriptionPlan,
      'subscription.features': req.body.subscriptionFeatures
    };

    // Remove undefined values
    Object.keys(updates).forEach(key => 
      updates[key] === undefined && delete updates[key]
    );

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password -sessions -apiKeys');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'user.admin_updated',
      resource: { type: 'user', id: user._id, name: user.fullName },
      details: {
        updatedFields: Object.keys(updates),
        updatedBy: req.user._id
      }
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update user' 
    });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (admin only)
 * @access  Private/Admin
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Prevent deleting super admin
    if (user.role === 'super_admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Cannot delete super admin user' 
      });
    }

    // Soft delete
    user.isActive = false;
    user.deletedAt = new Date();
    user.deletedBy = req.user._id;
    await user.save();

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'user.deleted',
      resource: { type: 'user', id: user._id, name: user.fullName },
      details: {
        deletedBy: req.user._id
      }
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete user' 
    });
  }
});

/**
 * @route   POST /api/users/:id/avatar
 * @desc    Upload user avatar
 * @access  Private
 */
router.post('/:id/avatar', 
  authMiddleware, 
  uploadMiddleware.single('avatar'),
  async (req, res) => {
    try {
      // Check if user can update this profile
      if (!req.user._id.equals(req.params.id) && req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          message: 'You can only update your own avatar' 
        });
      }

      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      // Update avatar
      user.profile.avatar = {
        url: req.file.location || req.file.path,
        provider: req.file.location ? 's3' : 'local'
      };

      await user.save();

      // Log activity
      await Activity.track({
        user: req.user._id,
        action: 'user.avatar_updated',
        resource: { type: 'user', id: user._id }
      });

      res.json({
        success: true,
        message: 'Avatar updated successfully',
        data: {
          avatar: user.profile.avatar
        }
      });
    } catch (error) {
      logger.error('Upload avatar error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to upload avatar' 
      });
    }
  }
);

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Admin reset user password
 * @access  Private/Admin
 */
router.post('/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    user.password = tempPassword;
    user.mustChangePassword = true;
    await user.save();

    // Send email with temporary password
    await EmailService.sendEmail({
      to: user.email,
      template: 'admin-password-reset',
      data: {
        firstName: user.firstName,
        tempPassword: tempPassword,
        adminName: req.user.fullName
      }
    });

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'user.password_reset_admin',
      resource: { type: 'user', id: user._id, name: user.fullName },
      details: {
        resetBy: req.user._id
      }
    });

    res.json({
      success: true,
      message: 'Password reset email sent to user'
    });
  } catch (error) {
    logger.error('Admin reset password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to reset password' 
    });
  }
});

/**
 * @route   GET /api/users/:id/activity
 * @desc    Get user activity
 * @access  Private
 */
router.get('/:id/activity', authMiddleware, async (req, res) => {
  try {
    // Check if user can view this activity
    if (!req.user._id.equals(req.params.id) && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'You can only view your own activity' 
      });
    }

    const { page = 1, limit = 50 } = req.query;

    const activities = await Activity.getUserActivities(req.params.id, {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    });

    const total = await Activity.countDocuments({ user: req.params.id });

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get user activity error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch activity' 
    });
  }
});

/**
 * @route   POST /api/users/:id/impersonate
 * @desc    Impersonate user (super admin only)
 * @access  Private/SuperAdmin
 */
router.post('/:id/impersonate', authMiddleware, async (req, res) => {
  try {
    // Only super admins can impersonate
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Insufficient permissions' 
      });
    }

    const user = await User.findById(req.params.id);

    if (!user || !user.isActive) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found or inactive' 
      });
    }

    // Generate impersonation token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        impersonatedBy: req.user._id
      },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'user.impersonated',
      resource: { type: 'user', id: user._id, name: user.fullName },
      details: {
        impersonatedBy: req.user._id
      }
    });

    res.json({
      success: true,
      message: 'Impersonation token generated',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Impersonate user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to impersonate user' 
    });
  }
});

module.exports = router;success: false,
      message: 'Registration failed' 
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validateAuth.login, async (req, res) => {
  try {
    const { email, password, twoFactorCode, rememberMe } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password +twoFactor.secret');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({ 
        success: false,
        message: 'Account is locked due to too many failed attempts' 
      });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    
    if (!isValidPassword) {
      // Record failed login
      user.recordLogin(req.ip, req.get('user-agent'), false);
      await user.save();
      
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        success: false,
        message: 'Please verify your email before logging in' 
      });
    }

    // Check 2FA if enabled
    if (user.twoFactor.enabled) {
      if (!twoFactorCode) {
        return res.status(200).json({
          success: true,
          requiresTwoFactor: true,
          message: 'Please enter your 2FA code'
        });
      }

      const isValid2FA = user.verifyTwoFactorToken(twoFactorCode);
      if (!isValid2FA) {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid 2FA code' 
        });
      }
    }

    // Generate tokens
    const tokenExpiry = rememberMe ? '30d' : '7d';
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry }
    );

    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: rememberMe ? '90d' : '30d' }
    );

    // Record successful login
    user.recordLogin(req.ip, req.get('user-agent'), true);
    user.createSession(refreshToken, req.ip, req.get('user-agent'));
    await user.save();

    // Log activity
    await Activity.track({
      user: user._id,
      action: 'user.logged_in',
      resource: { type: 'user', id: user._id },
      metadata: {
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.profile.avatar
        },
        tokens: {
          access: token,
          refresh: refreshToken
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Login failed' 
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    // Invalidate session
    if (refreshToken) {
      req.user.invalidateSession(refreshToken);
      await req.user.save();
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'user.logged_out',
      resource: { type: 'user', id: req.user._id }
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Logout failed' 
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ 
        success: false,
        message: 'Refresh token required' 
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token type' 
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid refresh token' 
      });
    }

    // Check if session exists
    const sessionExists = user.sessions.some(s => 
      s.token === crypto.createHash('sha256').update(refreshToken).digest('hex')
    );

    if (!sessionExists) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid session' 
      });
    }

    // Generate new access token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      data: {
        token
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ 
      success: false,
      message: 'Invalid refresh token' 
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', validateAuth.forgotPassword, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists, a password reset email has been sent'
      });
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save();

    // Send reset email
    await EmailService.sendEmail({
      to: email,
      template: 'password-reset',
      data: {
        firstName: user.firstName,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      }
    });

    // Log activity
    await Activity.track({
      user: user._id,
      action: 'user.password_reset_requested',
      resource: { type: 'user', id: user._id },
      metadata: {
        ip: req.ip
      }
    });

    res.json({
      success: true,
      message: 'If an account exists, a password reset email has been sent'
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process request' 
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', validateAuth.resetPassword, async (req, res) => {
  try {
    const { token, password } = req.body;

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired reset token' 
      });
    }

    // Validate password
    const validation = user.validatePassword(password);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false,
        message: validation.message 
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.mustChangePassword = false;
    await user.save();

    // Send confirmation email
    await EmailService.sendEmail({
      to: user.email,
      template: 'password-changed',
      data: {
        firstName: user.firstName
      }
    });

    // Log activity
    await Activity.track({
      user: user._id,
      action: 'user.password_reset',
      resource: { type: 'user', id: user._id },
      metadata: {
        ip: req.ip
      }
    });

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to reset password' 
    });
  }
});

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired verification token' 
      });
    }

    // Verify email
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Log activity
    await Activity.track({
      user: user._id,
      action: 'user.email_verified',
      resource: { type: 'user', id: user._id }
    });

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to verify email' 
    });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password (logged in)
 * @access  Private
 */
router.post('/change-password', authMiddleware, validateAuth.changePassword, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
    }

    // Validate new password
    const validation = user.validatePassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false,
        message: validation.message 
      });
    }

    // Update password
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    // Send notification email
    await EmailService.sendEmail({
      to: user.email,
      template: 'password-changed',
      data: {
        firstName: user.firstName
      }
    });

    // Log activity
    await Activity.track({
      user: user._id,
      action: 'user.password_changed',
      resource: { type: 'user', id: user._id }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to change password' 
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -sessions -apiKeys')
      .populate('organization', 'name logo');

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get user' 
    });
  }
});

/**
 * @route   PUT /api/auth/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', authMiddleware, validateAuth.updateProfile, async (req, res) => {
  try {
    const updates = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      displayName: req.body.displayName,
      'profile.phone': req.body.phone,
      'profile.bio': req.body.bio,
      'profile.title': req.body.title,
      'profile.department': req.body.department,
      'profile.location': req.body.location,
      'profile.language': req.body.language,
      'profile.dateFormat': req.body.dateFormat,
      preferences: req.body.preferences,
      notifications: req.body.notifications
    };

    // Remove undefined values
    Object.keys(updates).forEach(key => 
      updates[key] === undefined && delete updates[key]
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password -sessions -apiKeys');

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'user.profile_updated',
      resource: { type: 'user', id: req.user._id },
      details: { updatedFields: Object.keys(updates) }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update profile' 
    });
  }
});

/**
 * @route   POST /api/auth/2fa/setup
 * @desc    Setup 2FA
 * @access  Private
 */
router.post('/2fa/setup', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    // Generate secret
    const { secret, qrCode } = user.generateTwoFactorSecret();
    await user.save();

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(qrCode);

    res.json({
      success: true,
      data: {
        secret,
        qrCode: qrCodeDataUrl
      }
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to setup 2FA' 
    });
  }
});

/**
 * @route   POST /api/auth/2fa/verify
 * @desc    Verify and enable 2FA
 * @access  Private
 */
router.post('/2fa/verify', authMiddleware, validateAuth.verify2FA, async (req, res) => {
  try {
    const { token } = req.body;
    const user = req.user;

    // Verify token
    const isValid = user.verifyTwoFactorToken(token);
    
    if (!isValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid verification code' 
      });
    }

    // Enable 2FA
    user.twoFactor.enabled = true;
    user.twoFactor.secret = user.twoFactor.tempSecret;
    user.twoFactor.tempSecret = undefined;
    
    // Generate backup codes
    const backupCodes = user.generateBackupCodes();
    await user.save();

    // Log activity
    await Activity.track({
      user: user._id,
      action: 'user.2fa_enabled',
      resource: { type: 'user', id: user._id }
    });

    res.json({
      success: true,
      message: '2FA enabled successfully',
      data: {
        backupCodes
      }
    });
  } catch (error) {
    logger.error('2FA verify error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to verify 2FA' 
    });
  }
});

/**
 * @route   POST /api/auth/2fa/disable
 * @desc    Disable 2FA
 * @access  Private
 */
router.post('/2fa/disable', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    // Verify password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid password' 
      });
    }

    // Disable 2FA
    user.twoFactor.enabled = false;
    user.twoFactor.secret = undefined;
    user.twoFactor.backupCodes = [];
    await user.save();

    // Log activity
    await Activity.track({
      user: user._id,
      action: 'user.2fa_disabled',
      resource: { type: 'user', id: user._id }
    });

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    logger.error('2FA disable error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to disable 2FA' 
    });
  }
});

module.exports = router;