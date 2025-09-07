const logger = require('../utils/logger');

/**
 * Handle presence and status events
 */
module.exports = (io, socket, presenceService) => {
  // Update presence status
  socket.on('update-status', async (data) => {
    try {
      const { status } = data;
      const userId = socket.userId;
      
      const presence = await presenceService.updateUserStatus(userId, status);
      
      if (presence) {
        // Broadcast to user's contacts
        broadcastPresenceUpdate(io, userId, { status });
      }
      
      socket.emit('status-updated', { status });
      
    } catch (error) {
      logger.error('Error updating status:', error);
      socket.emit('presence-error', {
        message: 'Failed to update status'
      });
    }
  });

  // Get online users
  socket.on('get-online-users', async (data) => {
    try {
      const { userIds } = data;
      const onlineUsers = await presenceService.getOnlineUsers(userIds);
      
      socket.emit('online-users', { users: onlineUsers });
      
    } catch (error) {
      logger.error('Error getting online users:', error);
    }
  });

  // Subscribe to user presence
  socket.on('subscribe-presence', (data) => {
    const { userIds } = data;
    
    userIds.forEach(userId => {
      socket.join(`presence:${userId}`);
    });
    
    socket.emit('presence-subscribed', { userIds });
  });

  // Unsubscribe from user presence
  socket.on('unsubscribe-presence', (data) => {
    const { userIds } = data;
    
    userIds.forEach(userId => {
      socket.leave(`presence:${userId}`);
    });
    
    socket.emit('presence-unsubscribed', { userIds });
  });

  // Handle activity heartbeat
  socket.on('activity-heartbeat', () => {
    presenceService.updateActivity(socket.userId);
  });

  // Get presence statistics
  socket.on('get-presence-stats', () => {
    const stats = presenceService.getStatistics();
    socket.emit('presence-stats', stats);
  });

  // Handle user going away
  socket.on('user-away', () => {
    presenceService.updateUserStatus(socket.userId, 'away');
    broadcastPresenceUpdate(io, socket.userId, { status: 'away' });
  });

  // Handle user returning
  socket.on('user-active', () => {
    presenceService.updateUserStatus(socket.userId, 'online');
    broadcastPresenceUpdate(io, socket.userId, { status: 'online' });
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    // Presence service handles offline status in main disconnect handler
  });

  // Listen to presence service events
  presenceService.on('user-online', (presence) => {
    broadcastPresenceUpdate(io, presence.userId, {
      status: 'online',
      user: presence.user
    });
  });

  presenceService.on('user-offline', (data) => {
    broadcastPresenceUpdate(io, data.userId, {
      status: 'offline',
      lastSeen: data.lastSeen
    });
  });

  presenceService.on('status-changed', (data) => {
    broadcastPresenceUpdate(io, data.userId, {
      status: data.status
    });
  });

  presenceService.on('typing-started', (data) => {
    io.to(`contract:${data.contractId}`).emit('user-typing', {
      userId: data.userId,
      timestamp: new Date()
    });
  });

  presenceService.on('typing-stopped', (data) => {
    io.to(`contract:${data.contractId}`).emit('user-stopped-typing', {
      userId: data.userId,
      timestamp: new Date()
    });
  });
};

/**
 * Broadcast presence update to user's contacts
 */
async function broadcastPresenceUpdate(io, userId, update) {
  try {
    // Get user's contacts (collaborators, team members, etc.)
    const Contract = require('../models/Contract');
    const contracts = await Contract.find({
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    }).select('owner collaborators');
    
    const contactSet = new Set();
    contracts.forEach(contract => {
      contactSet.add(contract.owner.toString());
      contract.collaborators.forEach(c => {
        contactSet.add(c.user.toString());
      });
    });
    contactSet.delete(userId); // Remove self
    
    // Broadcast to contacts
    contactSet.forEach(contactId => {
      io.to(`presence:${userId}`).emit('presence-update', {
        userId,
        ...update,
        timestamp: new Date()
      });
    });
    
  } catch (error) {
    logger.error('Error broadcasting presence update:', error);
  }
}