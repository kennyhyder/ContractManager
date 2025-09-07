const logger = require('../utils/logger');

/**
 * Handle real-time collaboration events
 */
module.exports = (io, socket) => {
  const collaborationService = require('../services/collaborationService');
  const presenceService = require('../services/presenceService');

  // Join contract collaboration
  socket.on('join-contract', async (data) => {
    try {
      const { contractId } = data;
      const userId = socket.userId;

      // Join socket room
      socket.join(`contract:${contractId}`);

      // Initialize collaboration session
      const session = await collaborationService.initializeSession(contractId, userId);

      // Update presence
      presenceService.setUserContract(userId, contractId);

      // Get active collaborators
      const collaborators = await collaborationService.getActiveCollaborators(contractId);

      // Notify others
      socket.to(`contract:${contractId}`).emit('collaborator-joined', {
        userId,
        user: socket.user,
        timestamp: new Date()
      });

      // Send initial state
      socket.emit('contract-state', {
        ...session.documentState,
        collaborators,
        locks: Array.from(collaborationService.locks.entries())
          .filter(([key]) => key.startsWith(contractId))
          .map(([key, lock]) => ({ ...lock, key }))
      });

      logger.info(`User ${userId} joined contract ${contractId}`);
    } catch (error) {
      logger.error('Error joining contract:', error);
      socket.emit('collaboration-error', {
        action: 'join',
        error: error.message
      });
    }
  });

  // Leave contract collaboration
  socket.on('leave-contract', async (data) => {
    try {
      const { contractId } = data;
      const userId = socket.userId;

      // Leave socket room
      socket.leave(`contract:${contractId}`);

      // Remove from collaboration
      collaborationService.removeActiveCollaborator(contractId, userId);

      // Update presence
      presenceService.setUserContract(userId, null);

      // Release all locks
      await collaborationService.releaseAllLocks(contractId, userId);

      // Notify others
      socket.to(`contract:${contractId}`).emit('collaborator-left', {
        userId,
        timestamp: new Date()
      });

      logger.info(`User ${userId} left contract ${contractId}`);
    } catch (error) {
      logger.error('Error leaving contract:', error);
    }
  });

  // Handle content changes
  socket.on('content-change', async (data) => {
    try {
      const { contractId, changes, version } = data;
      const userId = socket.userId;

      // Apply changes
      const result = await collaborationService.applyChanges(
        contractId,
        userId,
        changes,
        version
      );

      // Broadcast to others
      socket.to(`contract:${contractId}`).emit('content-changed', {
        userId,
        changes: result.transformedChanges,
        version: result.newVersion,
        timestamp: new Date()
      });

      // Send acknowledgment
      socket.emit('change-acknowledged', {
        version: result.newVersion,
        checksum: result.checksum
      });

    } catch (error) {
      logger.error('Error applying content change:', error);
      socket.emit('collaboration-error', {
        action: 'change',
        error: error.message
      });
    }
  });

  // Handle cursor position
  socket.on('cursor-position', (data) => {
    const { contractId, position, selection } = data;
    
    socket.to(`contract:${contractId}`).emit('cursor-update', {
      userId: socket.userId,
      user: {
        id: socket.userId,
        name: socket.user.name,
        color: getUserColor(socket.userId)
      },
      position,
      selection,
      timestamp: new Date()
    });
  });

  // Handle selection
  socket.on('selection-change', (data) => {
    const { contractId, selection } = data;
    
    socket.to(`contract:${contractId}`).emit('selection-update', {
      userId: socket.userId,
      user: {
        id: socket.userId,
        name: socket.user.name,
        color: getUserColor(socket.userId)
      },
      selection,
      timestamp: new Date()
    });
  });

  // Handle section lock
  socket.on('lock-section', async (data) => {
    try {
      const { contractId, sectionId, type } = data;
      const userId = socket.userId;

      const result = await collaborationService.acquireLock(
        contractId,
        sectionId,
        userId,
        type
      );

      if (result.acquired) {
        // Notify all users
        io.to(`contract:${contractId}`).emit('section-locked', {
          sectionId,
          lockedBy: {
            id: userId,
            name: socket.user.name
          },
          type,
          expiresAt: result.expiresAt
        });
      }

      socket.emit('lock-result', result);
    } catch (error) {
      logger.error('Error locking section:', error);
      socket.emit('collaboration-error', {
        action: 'lock',
        error: error.message
      });
    }
  });

  // Handle section unlock
  socket.on('unlock-section', async (data) => {
    try {
      const { contractId, sectionId } = data;
      const userId = socket.userId;

      const released = await collaborationService.releaseLock(
        contractId,
        sectionId,
        userId
      );

      if (released) {
        io.to(`contract:${contractId}`).emit('section-unlocked', {
          sectionId,
          unlockedBy: userId
        });
      }
    } catch (error) {
      logger.error('Error unlocking section:', error);
    }
  });

  // Handle save request
  socket.on('save-contract', async (data) => {
    try {
      const { contractId } = data;
      const userId = socket.userId;

      const result = await collaborationService.saveContract(contractId, userId);

      io.to(`contract:${contractId}`).emit('contract-saved', {
        version: result.version,
        savedBy: {
          id: userId,
          name: socket.user.name
        },
        timestamp: result.timestamp
      });

    } catch (error) {
      logger.error('Error saving contract:', error);
      socket.emit('collaboration-error', {
        action: 'save',
        error: error.message
      });
    }
  });

  // Handle typing indicator
  socket.on('typing-start', (data) => {
    const { contractId } = data;
    
    presenceService.setUserTyping(socket.userId, contractId, true);
    
    socket.to(`contract:${contractId}`).emit('user-typing', {
      userId: socket.userId,
      user: socket.user,
      timestamp: new Date()
    });
  });

  socket.on('typing-stop', (data) => {
    const { contractId } = data;
    
    presenceService.setUserTyping(socket.userId, contractId, false);
    
    socket.to(`contract:${contractId}`).emit('user-stopped-typing', {
      userId: socket.userId,
      timestamp: new Date()
    });
  });

  // Handle collaboration metrics request
  socket.on('get-metrics', async (data) => {
    try {
      const { contractId } = data;
      const metrics = await collaborationService.getMetrics(contractId);
      
      socket.emit('collaboration-metrics', metrics);
    } catch (error) {
      logger.error('Error getting metrics:', error);
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', async () => {
    try {
      // Get all contracts user was in
      for (const room of socket.rooms) {
        if (room.startsWith('contract:')) {
          const contractId = room.replace('contract:', '');
          
          // Remove from collaboration
          collaborationService.removeActiveCollaborator(contractId, socket.userId);
          
          // Release locks
          await collaborationService.releaseAllLocks(contractId, socket.userId);
          
          // Notify others
          socket.to(room).emit('collaborator-left', {
            userId: socket.userId,
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      logger.error('Error in collaboration disconnect:', error);
    }
  });
};

// Helper function to generate consistent user colors
function getUserColor(userId) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766',
    '#2ECC71', '#E74C3C', '#9B59B6', '#F39C12',
    '#1ABC9C', '#3498DB', '#34495E', '#16A085'
  ];
  
  // Generate consistent index from userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  
  return colors[Math.abs(hash) % colors.length];
}