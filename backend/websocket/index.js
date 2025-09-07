const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { PresenceService } = require('../services/presenceService');
const { CollaborationService } = require('../services/collaborationService');
const { NotificationService } = require('../services/notificationService');

class WebSocketServer {
  constructor() {
    this.io = null;
    this.rooms = new Map();
    this.userSockets = new Map();
    this.presenceService = new PresenceService();
    this.collaborationService = new CollaborationService();
    this.notificationService = new NotificationService();
  }

  initialize(server) {
    this.io = socketIO(server, config.app.websocket);

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = config.auth.verifyToken(token);
        const User = require('../models/User');
        const user = await User.findById(decoded.sub).select('-password');
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Redis adapter for scaling
    if (config.redis.client) {
      const { createAdapter } = require('@socket.io/redis-adapter');
      this.io.adapter(createAdapter(config.redis.publisher, config.redis.subscriber));
    }

    logger.info('WebSocket server initialized');
  }

  handleConnection(socket) {
    logger.info(`User ${socket.userId} connected`);

    // Track user socket
    this.addUserSocket(socket.userId, socket.id);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Set user as online
    this.presenceService.setUserOnline(socket.userId);

    // Register event handlers
    this.registerHandlers(socket);

    // Handle disconnect
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  registerHandlers(socket) {
    // Contract collaboration
    socket.on('join-contract', (data) => this.handleJoinContract(socket, data));
    socket.on('leave-contract', (data) => this.handleLeaveContract(socket, data));
    socket.on('contract-update', (data) => this.handleContractUpdate(socket, data));
    socket.on('cursor-move', (data) => this.handleCursorMove(socket, data));
    socket.on('selection-change', (data) => this.handleSelectionChange(socket, data));
    
    // Comments
    socket.on('comment-add', (data) => this.handleCommentAdd(socket, data));
    socket.on('comment-update', (data) => this.handleCommentUpdate(socket, data));
    socket.on('comment-delete', (data) => this.handleCommentDelete(socket, data));
    
    // Typing indicators
    socket.on('typing-start', (data) => this.handleTypingStart(socket, data));
    socket.on('typing-stop', (data) => this.handleTypingStop(socket, data));
    
    // Presence
    socket.on('presence-update', (data) => this.handlePresenceUpdate(socket, data));
    socket.on('get-online-users', (data) => this.handleGetOnlineUsers(socket, data));
    
    // Notifications
    socket.on('notification-read', (data) => this.handleNotificationRead(socket, data));
    socket.on('notification-read-all', () => this.handleNotificationReadAll(socket));
  }

  // Contract collaboration handlers
  async handleJoinContract(socket, { contractId }) {
    try {
      // Verify user has access to contract
      const Contract = require('../models/Contract');
      const contract = await Contract.findById(contractId);
      
      if (!contract || !contract.hasAccess(socket.userId)) {
        return socket.emit('error', { message: 'Access denied' });
      }

      // Join contract room
      const roomName = `contract:${contractId}`;
      socket.join(roomName);

      // Track user in room
      if (!this.rooms.has(roomName)) {
        this.rooms.set(roomName, new Set());
      }
      this.rooms.get(roomName).add(socket.userId);

      // Get current collaborators
      const collaborators = await this.collaborationService.getCollaborators(contractId);
      
      // Notify others in room
      socket.to(roomName).emit('user-joined', {
        userId: socket.userId,
        user: socket.user,
        timestamp: new Date()
      });

      // Send current state to joining user
      socket.emit('contract-state', {
        contractId,
        collaborators,
        content: contract.content,
        version: contract.version
      });

      logger.info(`User ${socket.userId} joined contract ${contractId}`);
    } catch (error) {
      logger.error('Error joining contract:', error);
      socket.emit('error', { message: 'Failed to join contract' });
    }
  }

  async handleLeaveContract(socket, { contractId }) {
    const roomName = `contract:${contractId}`;
    socket.leave(roomName);

    // Remove user from room tracking
    if (this.rooms.has(roomName)) {
      this.rooms.get(roomName).delete(socket.userId);
      if (this.rooms.get(roomName).size === 0) {
        this.rooms.delete(roomName);
      }
    }

    // Notify others
    socket.to(roomName).emit('user-left', {
      userId: socket.userId,
      timestamp: new Date()
    });

    logger.info(`User ${socket.userId} left contract ${contractId}`);
  }

  async handleContractUpdate(socket, { contractId, changes, version }) {
    try {
      const roomName = `contract:${contractId}`;
      
      // Apply operational transformation if needed
      const transformed = await this.collaborationService.transformOperations(
        contractId,
        changes,
        version
      );

      // Broadcast to others in room
      socket.to(roomName).emit('contract-updated', {
        userId: socket.userId,
        changes: transformed.changes,
        version: transformed.version,
        timestamp: new Date()
      });

      // Save to database
      await this.collaborationService.saveChanges(contractId, socket.userId, transformed);
    } catch (error) {
      logger.error('Error updating contract:', error);
      socket.emit('error', { message: 'Failed to update contract' });
    }
  }

  handleCursorMove(socket, { contractId, position }) {
    const roomName = `contract:${contractId}`;
    socket.to(roomName).emit('cursor-moved', {
      userId: socket.userId,
      position,
      color: this.getUserColor(socket.userId),
      timestamp: new Date()
    });
  }

  handleSelectionChange(socket, { contractId, selection }) {
    const roomName = `contract:${contractId}`;
    socket.to(roomName).emit('selection-changed', {
      userId: socket.userId,
      selection,
      color: this.getUserColor(socket.userId),
      timestamp: new Date()
    });
  }

  // Comment handlers
  async handleCommentAdd(socket, { contractId, comment }) {
    try {
      const Comment = require('../models/Comment');
      const newComment = await Comment.create({
        contract: contractId,
        author: socket.userId,
        content: comment.content,
        position: comment.position,
        parentComment: comment.parentId
      });

      await newComment.populate('author', 'name email profilePicture');

      const roomName = `contract:${contractId}`;
      this.io.to(roomName).emit('comment-added', {
        comment: newComment,
        timestamp: new Date()
      });

      // Send notifications
      await this.notificationService.notifyCommentAdded(contractId, newComment);
    } catch (error) {
      logger.error('Error adding comment:', error);
      socket.emit('error', { message: 'Failed to add comment' });
    }
  }

  async handleCommentUpdate(socket, { commentId, content }) {
    try {
      const Comment = require('../models/Comment');
      const comment = await Comment.findById(commentId);
      
      if (!comment || comment.author.toString() !== socket.userId) {
        return socket.emit('error', { message: 'Unauthorized' });
      }

      comment.content = content;
      comment.isEdited = true;
      await comment.save();

      const roomName = `contract:${comment.contract}`;
      this.io.to(roomName).emit('comment-updated', {
        commentId,
        content,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error updating comment:', error);
      socket.emit('error', { message: 'Failed to update comment' });
    }
  }

  async handleCommentDelete(socket, { commentId }) {
    try {
      const Comment = require('../models/Comment');
      const comment = await Comment.findById(commentId);
      
      if (!comment || comment.author.toString() !== socket.userId) {
        return socket.emit('error', { message: 'Unauthorized' });
      }

      const contractId = comment.contract;
      await comment.remove();

      const roomName = `contract:${contractId}`;
      this.io.to(roomName).emit('comment-deleted', {
        commentId,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error deleting comment:', error);
      socket.emit('error', { message: 'Failed to delete comment' });
    }
  }

  // Typing indicators
  handleTypingStart(socket, { contractId }) {
    const roomName = `contract:${contractId}`;
    socket.to(roomName).emit('user-typing', {
      userId: socket.userId,
      user: socket.user,
      timestamp: new Date()
    });
  }

  handleTypingStop(socket, { contractId }) {
    const roomName = `contract:${contractId}`;
    socket.to(roomName).emit('user-stopped-typing', {
      userId: socket.userId,
      timestamp: new Date()
    });
  }

  // Presence handlers
  async handlePresenceUpdate(socket, { status }) {
    await this.presenceService.updateUserStatus(socket.userId, status);
    
    // Notify user's contacts
    const contacts = await this.getUser contacts(socket.userId);
    contacts.forEach(contactId => {
      this.io.to(`user:${contactId}`).emit('presence-updated', {
        userId: socket.userId,
        status,
        timestamp: new Date()
      });
    });
  }

  async handleGetOnlineUsers(socket, { userIds }) {
    const onlineUsers = await this.presenceService.getOnlineUsers(userIds);
    socket.emit('online-users', { users: onlineUsers });
  }

  // Notification handlers
  async handleNotificationRead(socket, { notificationId }) {
    try {
      const Notification = require('../models/Notification');
      await Notification.findByIdAndUpdate(notificationId, {
        isRead: true,
        readAt: new Date()
      });

      socket.emit('notification-marked-read', { notificationId });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  }

  async handleNotificationReadAll(socket) {
    try {
      const Notification = require('../models/Notification');
      await Notification.updateMany(
        { recipient: socket.userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      socket.emit('all-notifications-marked-read');
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    }
  }

  // Utility methods
  handleDisconnect(socket) {
    logger.info(`User ${socket.userId} disconnected`);

    // Remove from user sockets
    this.removeUserSocket(socket.userId, socket.id);

    // Set user as offline if no more connections
    if (!this.hasUserSockets(socket.userId)) {
      this.presenceService.setUserOffline(socket.userId);
    }

    // Leave all contract rooms
    this.rooms.forEach((users, roomName) => {
      if (users.has(socket.userId)) {
        users.delete(socket.userId);
        socket.to(roomName).emit('user-left', {
          userId: socket.userId,
          timestamp: new Date()
        });
      }
    });
  }

  addUserSocket(userId, socketId) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socketId);
  }

  removeUserSocket(userId, socketId) {
    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socketId);
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  hasUserSockets(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  getUserColor(userId) {
    // Generate consistent color for user
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766',
      '#2ECC71', '#E74C3C', '#9B59B6', '#F39C12'
    ];
    const index = parseInt(userId.slice(-2), 16) % colors.length;
    return colors[index];
  }

  async getUserContacts(userId) {
    // Get user's collaborators from recent contracts
    const Contract = require('../models/Contract');
    const contracts = await Contract.find({
      $or: [
        { owner: userId },
        { collaborators: userId }
      ]
    }).select('owner collaborators');

    const contactSet = new Set();
    contracts.forEach(contract => {
      contactSet.add(contract.owner.toString());
      contract.collaborators.forEach(c => contactSet.add(c.toString()));
    });
    contactSet.delete(userId);

    return Array.from(contactSet);
  }

  // Public methods for sending notifications
  sendToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  sendToContract(contractId, event, data) {
    this.io.to(`contract:${contractId}`).emit(event, data);
  }

  broadcast(event, data) {
    this.io.emit(event, data);
  }

  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  getRoomUsers(contractId) {
    const roomName = `contract:${contractId}`;
    return this.rooms.has(roomName) ? Array.from(this.rooms.get(roomName)) : [];
  }
}

module.exports = new WebSocketServer();