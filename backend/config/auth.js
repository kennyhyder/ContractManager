const jwt = require('jsonwebtoken');
const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: MicrosoftStrategy } = require('passport-microsoft');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

class AuthConfig {
  constructor() {
    this.jwtOptions = {
      secret: process.env.JWT_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      algorithm: 'HS256',
      issuer: 'Contract Management System',
      audience: 'contract-management-users'
    };

    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
    this.maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5;
    this.lockoutDuration = parseInt(process.env.LOCKOUT_DURATION, 10) || 15 * 60 * 1000; // 15 minutes
  }

  initialize() {
    this.configurePassport();
  }

  configurePassport() {
    // JWT Strategy
    const jwtOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: this.jwtOptions.secret,
      issuer: this.jwtOptions.issuer,
      audience: this.jwtOptions.audience,
    };

    passport.use(new JwtStrategy(jwtOptions, async (payload, done) => {
      try {
        const User = require('../models/User');
        const user = await User.findById(payload.sub).select('-password');
        
        if (!user) {
          return done(null, false);
        }

        if (user.isLocked()) {
          return done(null, false, { message: 'Account is locked' });
        }

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }));

    // Google OAuth Strategy
    if (process.env.GOOGLE_CLIENT_ID) {
      passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        scope: ['profile', 'email']
      }, this.oauthCallback('google')));
    }

    // Microsoft OAuth Strategy
    if (process.env.MICROSOFT_CLIENT_ID) {
      passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: '/api/auth/microsoft/callback',
        scope: ['user.read']
      }, this.oauthCallback('microsoft')));
    }

    // LinkedIn OAuth Strategy
    if (process.env.LINKEDIN_CLIENT_ID) {
      passport.use(new LinkedInStrategy({
        clientID: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        callbackURL: '/api/auth/linkedin/callback',
        scope: ['r_emailaddress', 'r_liteprofile']
      }, this.oauthCallback('linkedin')));
    }
  }

  oauthCallback(provider) {
    return async (accessToken, refreshToken, profile, done) => {
      try {
        const User = require('../models/User');
        
        // Extract email from profile
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        
        if (!email) {
          return done(null, false, { message: 'No email found in profile' });
        }

        // Find or create user
        let user = await User.findOne({ email });
        
        if (!user) {
          // Create new user
          user = await User.create({
            email,
            name: profile.displayName || `${profile.name.givenName} ${profile.name.familyName}`,
            provider,
            providerId: profile.id,
            profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            isVerified: true, // OAuth users are pre-verified
          });
        } else {
          // Update existing user
          if (!user.providers.includes(provider)) {
            user.providers.push(provider);
            user[`${provider}Id`] = profile.id;
            await user.save();
          }
        }

        return done(null, user);
      } catch (error) {
        logger.error(`OAuth callback error for ${provider}:`, error);
        return done(error, false);
      }
    };
  }

  // Generate JWT token
  generateToken(user) {
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      iat: Date.now(),
    };

    const token = jwt.sign(payload, this.jwtOptions.secret, {
      expiresIn: this.jwtOptions.expiresIn,
      algorithm: this.jwtOptions.algorithm,
      issuer: this.jwtOptions.issuer,
      audience: this.jwtOptions.audience,
    });

    return token;
  }

  // Generate refresh token
  generateRefreshToken(user) {
    const payload = {
      sub: user._id,
      type: 'refresh',
      iat: Date.now(),
    };

    const refreshToken = jwt.sign(payload, this.jwtOptions.refreshSecret, {
      expiresIn: this.jwtOptions.refreshExpiresIn,
      algorithm: this.jwtOptions.algorithm,
      issuer: this.jwtOptions.issuer,
    });

    return refreshToken;
  }

  // Verify token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtOptions.secret, {
        algorithms: [this.jwtOptions.algorithm],
        issuer: this.jwtOptions.issuer,
        audience: this.jwtOptions.audience,
      });
    } catch (error) {
      logger.error('Token verification failed:', error);
      throw error;
    }
  }

  // Verify refresh token
  verifyRefreshToken(refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, this.jwtOptions.refreshSecret, {
        algorithms: [this.jwtOptions.algorithm],
        issuer: this.jwtOptions.issuer,
      });

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      throw error;
    }
  }

  // Generate password reset token
  generateResetToken(user) {
    const payload = {
      sub: user._id,
      email: user.email,
      type: 'reset',
      iat: Date.now(),
    };

    return jwt.sign(payload, this.jwtOptions.secret, {
      expiresIn: '1h',
      algorithm: this.jwtOptions.algorithm,
      issuer: this.jwtOptions.issuer,
    });
  }

  // Verify password reset token
  verifyResetToken(token) {
    try {
      const payload = jwt.verify(token, this.jwtOptions.secret, {
        algorithms: [this.jwtOptions.algorithm],
        issuer: this.jwtOptions.issuer,
      });

      if (payload.type !== 'reset') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      logger.error('Reset token verification failed:', error);
      throw error;
    }
  }

  // Two-Factor Authentication methods
  generate2FASecret(user) {
    const secret = speakeasy.generateSecret({
      name: `Contract Management (${user.email})`,
      issuer: process.env.TWO_FACTOR_ISSUER || 'Contract Management System',
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
    };
  }

  async generate2FAQRCode(otpauthUrl) {
    try {
      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      logger.error('Failed to generate 2FA QR code:', error);
      throw error;
    }
  }

  verify2FAToken(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps in either direction
    });
  }

  // Generate backup codes
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(speakeasy.generate({ length: 8 }).base32);
    }
    return codes;
  }

  // Session configuration
  getSessionConfig() {
    return {
      secret: process.env.SESSION_SECRET,
      name: process.env.SESSION_NAME || 'sessionId',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict',
      },
    };
  }

  // CORS configuration
  getCorsConfig() {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000'];

    return {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400, // 24 hours
    };
  }

  // Rate limiting configuration
  getRateLimitConfig(type = 'general') {
    const configs = {
      general: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
      },
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 requests per window
        message: 'Too many authentication attempts, please try again later.',
        skipSuccessfulRequests: true,
      },
      api: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 60, // 60 requests per minute
        message: 'API rate limit exceeded.',
      },
    };

    return configs[type] || configs.general;
  }
}

module.exports = new AuthConfig();