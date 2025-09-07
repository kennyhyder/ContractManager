const { User } = require('../models');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class PresenceService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.presenceData = new Map(); // userId -> presence info
    this.contractPresence = new Map(); // contractId -> Set of userIds
    this.lastActivity = new Map(); // userId -> timestamp
    this.cleanupInterval = null;
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Set user as online
   */
  async setUserOnline(userId, socketId) {
    try {
      const user = await User.findById(userId)
        .select('name email profilePicture role');

      if (!user) {
        throw new Error('User not found');
      }

      const presence = {
        userId: userId.toString(),
        socketId,
        status: 'online',
        lastSeen: new Date(),
        currentContract: null,
        device: {
          browser: null,
          os: null
        },
        user: {
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture,
          role: user.role
        }
      };

      this.presenceData.set(userId.toString(), presence);
      this.lastActivity.set(userId.toString(), new Date());

      // Update user's last activity in database
      await User.findByIdAndUpdate(userId, {
        lastActivity: new Date(),
        isOnline: true
      });

      // Emit online event
      this.emit('user-online', presence);

      logger.info(`User ${userId} is now online`);
      return presence;
    } catch (error) {
      logger.error('Error setting user online:', error);
      throw error;
    }
  }

  /**
   * Set user as offline
   */
  async setUserOffline(userId) {
    try {
      const presence = this.presenceData.get(userId.toString());
      
      if (presence) {
        // Remove from all contract presence
        for (const [contractId, users] of this.contractPresence.entries()) {
          users.delete(userId.toString());
          if (users.size === 0) {
            this.contractPresence.delete(contractId);
          }
        }

        // Update presence
        presence.status = 'offline';
        presence.lastSeen = new Date();

        // Update database
        await User.findByIdAndUpdate(userId, {
          lastActivity: new Date(),
          isOnline: false
        });

        // Remove from active presence
        this.presenceData.delete(userId.toString());
        this.lastActivity.delete(userId.toString());

        // Emit offline event
        this.emit('user-offline', { userId, lastSeen: presence.lastSeen });

        logger.info(`User ${userId} is now offline`);
      }
    } catch (error) {
      logger.error('Error setting user offline:', error);
    }
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId, status) {
    const presence = this.presenceData.get(userId.toString());
    
    if (presence) {
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      presence.status = status;
      presence.lastSeen = new Date();
      this.lastActivity.set(userId.toString(), new Date());

      // Emit status change
      this.emit('status-changed', { userId, status });

      return presence;
    }

    return null;
  }

  /**
   * Set user's current contract
   */
  setUserContract(userId, contractId) {
    const presence = this.presenceData.get(userId.toString());
    
    if (presence) {
      // Remove from previous contract
      if (presence.currentContract) {
        const prevUsers = this.contractPresence.get(presence.currentContract);
        if (prevUsers) {
          prevUsers.delete(userId.toString());
        }
      }

      // Add to new contract
      if (contractId) {
        if (!this.contractPresence.has(contractId)) {
          this.contractPresence.set(contractId, new Set());
        }
        this.contractPresence.get(contractId).add(userId.toString());
        presence.currentContract = contractId;
      } else {
        presence.currentContract = null;
      }

      this.lastActivity.set(userId.toString(), new Date());
    }
  }

  /**
   * Get online users
   */
  async getOnlineUsers(userIds = null) {
    if (userIds) {
      // Get specific users' presence
      const presence = [];
      for (const userId of userIds) {
        const userPresence = this.presenceData.get(userId.toString());
        if (userPresence) {
          presence.push(userPresence);
        } else {
          // Check database for last seen
          const user = await User.findById(userId)
            .select('name email profilePicture lastActivity isOnline');
          
          if (user) {
            presence.push({
              userId: userId.toString(),
              status: user.isOnline ? 'online' : 'offline',
              lastSeen: user.lastActivity,
              user: {
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture
              }
            });
          }
        }
      }
      return presence;
    } else {
      // Return all online users
      return Array.from(this.presenceData.values());
    }
  }

  /**
   * Get users in a contract
   */
  getUsersInContract(contractId) {
    const userIds = this.contractPresence.get(contractId);
    
    if (!userIds || userIds.size === 0) {
      return [];
    }

    const users = [];
    for (const userId of userIds) {
      const presence = this.presenceData.get(userId);
      if (presence) {
        users.push(presence);
      }
    }

    return users;
  }

  /**
   * Update last activity
   */
  updateActivity(userId) {
    this.lastActivity.set(userId.toString(), new Date());
    
    const presence = this.presenceData.get(userId.toString());
    if (presence) {
      presence.lastSeen = new Date();
      
      // Reset status from away to online if inactive
      if (presence.status === 'away') {
        presence.status = 'online';
        this.emit('status-changed', { userId, status: 'online' });
      }
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    // Check for inactive users every minute
    this.cleanupInterval = setInterval(() => {
      this.checkInactiveUsers();
    }, 60 * 1000); // 1 minute
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Check for inactive users
   */
  checkInactiveUsers() {
    const now = new Date();
    const awayTimeout = 5 * 60 * 1000; // 5 minutes
    const offlineTimeout = 15 * 60 * 1000; // 15 minutes

    for (const [userId, lastActive] of this.lastActivity.entries()) {
      const timeSinceActive = now - lastActive;
      const presence = this.presenceData.get(userId);

      if (presence) {
        if (timeSinceActive > offlineTimeout && presence.status !== 'offline') {
          // Set as offline
          this.setUserOffline(userId);
        } else if (timeSinceActive > awayTimeout && presence.status === 'online') {
          // Set as away
          presence.status = 'away';
          this.emit('status-changed', { userId, status: 'away' });
        }
      }
    }
  }

  /**
   * Get presence statistics
   */
  getStatistics() {
    const stats = {
      totalOnline: this.presenceData.size,
      byStatus: {
        online: 0,
        away: 0,
        busy: 0
      },
      byContract: {}
    };

    // Count by status
    for (const presence of this.presenceData.values()) {
      if (stats.byStatus[presence.status] !== undefined) {
        stats.byStatus[presence.status]++;
      }
    }

    // Count by contract
    for (const [contractId, users] of this.contractPresence.entries()) {
      stats.byContract[contractId] = users.size;
    }

    return stats;
  }

  /**
   * Broadcast presence update
   */
  broadcastPresenceUpdate(userId, update) {
    // Broadcast to user's contacts
    if (this.io) {
      this.io.emit('presence-update', {
        userId,
        ...update,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle user typing
   */
  setUserTyping(userId, contractId, isTyping) {
    const presence = this.presenceData.get(userId.toString());
    
    if (presence) {
      if (!presence.typing) {
        presence.typing = {};
      }

      if (isTyping) {
        presence.typing[contractId] = {
          started: new Date(),
          timeout: setTimeout(() => {
            delete presence.typing[contractId];
            this.emit('typing-stopped', { userId, contractId });
          }, 5000) // Auto-stop after 5 seconds
        };

        this.emit('typing-started', { userId, contractId });
      } else {
        if (presence.typing[contractId]) {
          clearTimeout(presence.typing[contractId].timeout);
          delete presence.typing[contractId];
        }
        this.emit('typing-stopped', { userId, contractId });
      }
    }
  }

  /**
   * Get typing users in contract
   */
  getTypingUsers(contractId) {
    const typingUsers = [];
    
    for (const presence of this.presenceData.values()) {
      if (presence.typing && presence.typing[contractId]) {
        typingUsers.push({
          userId: presence.userId,
          user: presence.user,
          startedAt: presence.typing[contractId].started
        });
      }
    }

    return typingUsers;
  }
}

module.exports = PresenceService;