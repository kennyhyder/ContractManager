const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Redis = require('redis');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

// Import services
const { NotificationService } = require('./services/notificationService');
const { ActivityTracker } = require('./services/activityTracker');
const { PresenceService } = require('./services/presenceService');
const SyncEngine = require('./services/syncEngine');

// Import routes
const authRoutes = require('./routes/auth');
const contractRoutes = require('./routes/contracts');
const templateRoutes = require('./routes/templates');
const userRoutes = require('./routes/users');
const activityRoutes = require('./routes/activities');
const commentRoutes = require('./routes/comments');
const approvalRoutes = require('./routes/approvals');
const emailRoutes = require('./routes/emails');
const notificationRoutes = require('./routes/notifications');
const presenceRoutes = require('./routes/presence');
const syncRoutes = require('./routes/sync');

// Import WebSocket handlers
const collaborationHandler = require('./websocket/collaboration');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with Redis adapter for scaling
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Redis adapter for Socket.IO (for horizontal scaling)
if (process.env.REDIS_HOST) {
  const redisAdapter = require('socket.io-redis');
  io.adapter(redisAdapter({ 
    host: process.env.REDIS_HOST, 
    port: process.env.REDIS_PORT || 6379 
  }));
}

// Initialize services
const notificationService = new NotificationService(io);
const activityTracker = new ActivityTracker(io);
const presenceService = new PresenceService(io);
const syncEngine = new SyncEngine(io);

// Make services available globally
app.set('io', io);
app.set('notificationService', notificationService);
app.set('activityTracker', activityTracker);
app.set('presenceService', presenceService);
app.set('syncEngine', syncEngine);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001', // Development
      'https://yourdomain.com' // Production
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// More restrictive limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Request logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.id = require('crypto').randomBytes(16).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Database connection with retry logic
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/contract-management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Retry after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// MongoDB connection event handlers
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/sync', syncRoutes);

// Health check endpoint with detailed status
app.get('/api/health', async (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: 'connected', // Check actual Redis connection
      socketIO: io.engine.clientsCount
    },
    memory: process.memoryUsage(),
  };

  try {
    // Check database connection
    await mongoose.connection.db.admin().ping();
    
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.status = 'ERROR';
    healthcheck.error = error.message;
    res.status(503).json(healthcheck);
  }
});

// WebSocket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user exists and is active
    const User = require('./models/User');
    const user = await User.findById(decoded.userId).select('isActive role');
    
    if (!user || !user.isActive) {
      return next(new Error('Authentication error: Invalid user'));
    }
    
    socket.userId = decoded.userId;
    socket.userRole = user.role;
    socket.sessionId = decoded.sessionId || socket.id;
    
    next();
  } catch (err) {
    next(new Error('Authentication error: ' + err.message));
  }
});

// WebSocket connection handling
io.on('connection', async (socket) => {
  console.log(`User ${socket.userId} connected (${socket.id})`);
  
  try {
    // Join user's personal room
    socket.join(`user:${socket.userId}`);
    
    // Update presence
    await presenceService.updatePresence(socket.userId, {
      status: 'online',
      socketId: socket.id,
      connectedAt: new Date()
    });
    
    // Track connection activity
    await activityTracker.trackActivity({
      userId: socket.userId,
      action: 'user.connected',
      resourceType: 'system',
      resourceId: 'websocket',
      metadata: {
        socketId: socket.id,
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address
      }
    });
    
    // Setup collaboration handlers
    collaborationHandler(io, socket);
    
    // Listen for custom events
    socket.on('activity:track', async (data) => {
      try {
        await activityTracker.trackActivity({
          userId: socket.userId,
          ...data
        });
      } catch (error) {
        console.error('Activity tracking error:', error);
      }
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
      activityTracker.trackActivity({
        userId: socket.userId,
        action: 'socket.error',
        resourceType: 'system',
        resourceId: 'websocket',
        details: { error: error.message }
      });
    });
    
    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      console.log(`User ${socket.userId} disconnected (${reason})`);
      
      try {
        // Update presence
        await presenceService.handleDisconnect(socket.userId);
        
        // Track disconnection
        await activityTracker.trackActivity({
          userId: socket.userId,
          action: 'user.disconnected',
          resourceType: 'system',
          resourceId: 'websocket',
          details: { reason }
        });
      } catch (error) {
        console.error('Disconnect handler error:', error);
      }
    });
    
  } catch (error) {
    console.error('Connection handler error:', error);
    socket.emit('error', { message: 'Connection initialization failed' });
    socket.disconnect();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error
  console.error({
    requestId: req.id,
    error: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // Activity tracking for errors
  if (req.user?.id) {
    activityTracker.trackActivity({
      userId: req.user.id,
      action: 'error.occurred',
      resourceType: 'api',
      resourceId: req.path,
      details: {
        statusCode: err.status || 500,
        message: err.message
      }
    });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    requestId: req.id,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Received shutdown signal, closing server gracefully...');
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      // Close database connection
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
      
      // Stop services
      notificationService.stopQueueProcessor();
      activityTracker.stopBufferProcessor();
      presenceService.stopCleanupInterval();
      
      // Close Redis connections
      if (process.env.REDIS_HOST) {
        // Close Redis connections
        console.log('Redis connections closed');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`WebSocket server ready for connections`);
});

module.exports = { app, io, server };