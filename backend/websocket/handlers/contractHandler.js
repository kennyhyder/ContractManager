const logger = require('../../utils/logger');
const { CollaborationService } = require('../../services/collaborationService');
const Contract = require('../../models/Contract');
const Activity = require('../../models/Activity');

class ContractHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.collaborationService = new CollaborationService();
  }

  async handleJoinContract({ contractId }) {
    try {
      // Verify access
      const contract = await Contract.findById(contractId);
      if (!contract || !contract.hasAccess(this.socket.userId)) {
        throw new Error('Access denied');
      }

      // Join room
      const room = `contract:${contractId}`;
      await this.socket.join(room);

      // Get current state
      const state = await this.collaborationService.getContractState(contractId);
      const collaborators = await this.collaborationService.getActiveCollaborators(contractId);

      // Send state to joining user
      this.socket.emit('contract:joined', {
        contractId,
        state,
        collaborators,
        version: contract.version
      });

      // Notify others
      this.socket.to(room).emit('collaborator:joined', {
        user: {
          id: this.socket.userId,
          name: this.socket.user.name,
          email: this.socket.user.email,
          profilePicture: this.socket.user.profilePicture
        },
        timestamp: new Date()
      });

      // Update presence
      await this.collaborationService.addActiveCollaborator(contractId, this.socket.userId);

      // Log activity
      await Activity.create({
        user: this.socket.userId,
        action: 'contract.joined',
        resource: 'Contract',
        resourceId: contractId,
        metadata: { socketId: this.socket.id }
      });

      logger.info(`User ${this.socket.userId} joined contract ${contractId}`);
    } catch (error) {
      logger.error('Error joining contract:', error);
      this.socket.emit('contract:error', {
        action: 'join',
        error: error.message
      });
    }
  }

  async handleLeaveContract({ contractId }) {
    try {
      const room = `contract:${contractId}`;
      
      // Leave room
      await this.socket.leave(room);

      // Notify others
      this.socket.to(room).emit('collaborator:left', {
        userId: this.socket.userId,
        timestamp: new Date()
      });

      // Update presence
      await this.collaborationService.removeActiveCollaborator(contractId, this.socket.userId);

      // Clean up any locks
      await this.collaborationService.releaseAllLocks(contractId, this.socket.userId);

      logger.info(`User ${this.socket.userId} left contract ${contractId}`);
    } catch (error) {
      logger.error('Error leaving contract:', error);
    }
  }

  async handleContentChange({ contractId, changes, version }) {
    try {
      const room = `contract:${contractId}`;

      // Apply operational transformation
      const result = await this.collaborationService.applyChanges(
        contractId,
        this.socket.userId,
        changes,
        version
      );

      // Broadcast to others
      this.socket.to(room).emit('contract:changed', {
        userId: this.socket.userId,
        changes: result.transformedChanges,
        version: result.newVersion,
        timestamp: new Date()
      });

      // Acknowledge to sender
      this.socket.emit('contract:change-applied', {
        version: result.newVersion,
        timestamp: new Date()
      });

      // Auto-save after delay
      await this.collaborationService.scheduleAutoSave(contractId);

    } catch (error) {
      logger.error('Error applying content change:', error);
      this.socket.emit('contract:error', {
        action: 'change',
        error: error.message,
        version
      });
    }
  }

  async handleLockSection({ contractId, sectionId, type }) {
    try {
      const room = `contract:${contractId}`;

      // Attempt to acquire lock
      const lock = await this.collaborationService.acquireLock(
        contractId,
        sectionId,
        this.socket.userId,
        type
      );

      if (lock.acquired) {
        // Notify all users in room
        this.io.to(room).emit('section:locked', {
          sectionId,
          lockedBy: {
            id: this.socket.userId,
            name: this.socket.user.name
          },
          type,
          expiresAt: lock.expiresAt
        });
      } else {
        // Lock denied
        this.socket.emit('section:lock-denied', {
          sectionId,
          lockedBy: lock.lockedBy,
          reason: lock.reason
        });
      }
    } catch (error) {
      logger.error('Error locking section:', error);
      this.socket.emit('contract:error', {
        action: 'lock',
        error: error.message
      });
    }
  }

  async handleUnlockSection({ contractId, sectionId }) {
    try {
      const room = `contract:${contractId}`;

      // Release lock
      await this.collaborationService.releaseLock(
        contractId,
        sectionId,
        this.socket.userId
      );

      // Notify all users
      this.io.to(room).emit('section:unlocked', {
        sectionId,
        unlockedBy: this.socket.userId
      });
    } catch (error) {
      logger.error('Error unlocking section:', error);
    }
  }

  async handleSaveContract({ contractId }) {
    try {
      // Save current state
      const result = await this.collaborationService.saveContract(
        contractId,
        this.socket.userId
      );

      // Notify all collaborators
      const room = `contract:${contractId}`;
      this.io.to(room).emit('contract:saved', {
        version: result.version,
        savedBy: {
          id: this.socket.userId,
          name: this.socket.user.name
        },
        timestamp: result.timestamp
      });

      // Log activity
      await Activity.create({
        user: this.socket.userId,
        action: 'contract.saved',
        resource: 'Contract',
        resourceId: contractId,
        metadata: { version: result.version }
      });

    } catch (error) {
      logger.error('Error saving contract:', error);
      this.socket.emit('contract:error', {
        action: 'save',
        error: error.message
      });
    }
  }

  async handleRequestVersion({ contractId, version }) {
    try {
      const versionData = await this.collaborationService.getVersion(contractId, version);
      
      this.socket.emit('contract:version', {
        contractId,
        version,
        data: versionData
      });
    } catch (error) {
      logger.error('Error fetching version:', error);
      this.socket.emit('contract:error', {
        action: 'get-version',
        error: error.message
      });
    }
  }

  async handleCursorUpdate({ contractId, position, selection }) {
    const room = `contract:${contractId}`;
    
    this.socket.to(room).emit('cursor:updated', {
      userId: this.socket.userId,
      user: {
        name: this.socket.user.name,
        color: this.getUserColor()
      },
      position,
      selection,
      timestamp: new Date()
    });
  }

  getUserColor() {
    // Generate consistent color based on user ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766',
      '#2ECC71', '#E74C3C', '#9B59B6', '#F39C12',
      '#3498DB', '#1ABC9C', '#34495E', '#16A085'
    ];
    const index = parseInt(this.socket.userId.slice(-2), 16) % colors.length;
    return colors[index];
  }
}

module.exports = ContractHandler;