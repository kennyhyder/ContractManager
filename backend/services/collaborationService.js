const { Contract, User, Activity } = require('../models');
const logger = require('../utils/logger');
const DiffMatchPatch = require('diff-match-patch');
const crypto = require('crypto');

class CollaborationService {
  constructor() {
    this.dmp = new DiffMatchPatch();
    this.activeSessions = new Map(); // contractId -> Set of userIds
    this.documentStates = new Map(); // contractId -> document state
    this.locks = new Map(); // contractId:sectionId -> lock info
    this.operationQueue = new Map(); // contractId -> operation queue
  }

  /**
   * Initialize collaboration session for a contract
   */
  async initializeSession(contractId, userId) {
    try {
      // Get contract data
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Initialize document state if not exists
      if (!this.documentStates.has(contractId)) {
        this.documentStates.set(contractId, {
          content: contract.content,
          version: contract.version || 1,
          lastModified: contract.updatedAt,
          checksum: this.calculateChecksum(contract.content)
        });
      }

      // Add user to active sessions
      if (!this.activeSessions.has(contractId)) {
        this.activeSessions.set(contractId, new Set());
      }
      this.activeSessions.get(contractId).add(userId);

      // Initialize operation queue
      if (!this.operationQueue.has(contractId)) {
        this.operationQueue.set(contractId, []);
      }

      logger.info(`Collaboration session initialized for contract ${contractId} by user ${userId}`);

      return {
        documentState: this.documentStates.get(contractId),
        activeUsers: Array.from(this.activeSessions.get(contractId))
      };
    } catch (error) {
      logger.error('Failed to initialize collaboration session:', error);
      throw error;
    }
  }

  /**
   * Get current contract state
   */
  async getContractState(contractId) {
    const state = this.documentStates.get(contractId);
    if (!state) {
      // Load from database if not in memory
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }
      return {
        content: contract.content,
        version: contract.version || 1,
        lastModified: contract.updatedAt
      };
    }
    return state;
  }

  /**
   * Apply changes using operational transformation
   */
  async applyChanges(contractId, userId, changes, clientVersion) {
    try {
      const currentState = this.documentStates.get(contractId);
      if (!currentState) {
        throw new Error('No active session for this contract');
      }

      // Check version conflict
      if (clientVersion < currentState.version) {
        // Need to transform operations
        const transformedChanges = await this.transformOperations(
          contractId,
          changes,
          clientVersion,
          currentState.version
        );
        changes = transformedChanges;
      }

      // Apply changes
      const newContent = this.applyOperations(currentState.content, changes);
      
      // Update state
      currentState.content = newContent;
      currentState.version += 1;
      currentState.lastModified = new Date();
      currentState.checksum = this.calculateChecksum(newContent);

      // Add to operation queue
      this.operationQueue.get(contractId).push({
        userId,
        changes,
        version: currentState.version,
        timestamp: new Date()
      });

      // Log activity
      await Activity.create({
        user: userId,
        action: 'contract.edited',
        resource: 'Contract',
        resourceId: contractId,
        metadata: {
          version: currentState.version,
          changeSize: JSON.stringify(changes).length
        }
      });

      return {
        transformedChanges: changes,
        newVersion: currentState.version,
        checksum: currentState.checksum
      };
    } catch (error) {
      logger.error('Failed to apply changes:', error);
      throw error;
    }
  }

  /**
   * Transform operations for conflict resolution
   */
  async transformOperations(contractId, operations, fromVersion, toVersion) {
    const queue = this.operationQueue.get(contractId) || [];
    const relevantOps = queue.filter(op => op.version > fromVersion && op.version <= toVersion);

    let transformedOps = operations;
    for (const queuedOp of relevantOps) {
      transformedOps = this.transformAgainst(transformedOps, queuedOp.changes);
    }

    return transformedOps;
  }

  /**
   * Transform one set of operations against another
   */
  transformAgainst(ops1, ops2) {
    // Simplified transformation logic
    // In production, use a proper OT library
    return ops1.map(op => {
      if (op.type === 'insert' && ops2.some(o => o.type === 'insert' && o.position <= op.position)) {
        // Adjust position based on previous insertions
        const offset = ops2.filter(o => o.type === 'insert' && o.position <= op.position)
          .reduce((sum, o) => sum + o.text.length, 0);
        return { ...op, position: op.position + offset };
      }
      return op;
    });
  }

  /**
   * Apply operations to content
   */
  applyOperations(content, operations) {
    let result = content;
    
    // Sort operations by position (descending to avoid position shifts)
    const sortedOps = [...operations].sort((a, b) => b.position - a.position);

    for (const op of sortedOps) {
      switch (op.type) {
        case 'insert':
          result = result.slice(0, op.position) + op.text + result.slice(op.position);
          break;
        case 'delete':
          result = result.slice(0, op.position) + result.slice(op.position + op.length);
          break;
        case 'replace':
          result = result.slice(0, op.position) + op.text + result.slice(op.position + op.length);
          break;
      }
    }

    return result;
  }

  /**
   * Acquire lock on a section
   */
  async acquireLock(contractId, sectionId, userId, type = 'edit') {
    const lockKey = `${contractId}:${sectionId}`;
    const existingLock = this.locks.get(lockKey);

    if (existingLock && existingLock.userId !== userId) {
      // Check if lock expired
      if (new Date() - existingLock.acquiredAt > 5 * 60 * 1000) { // 5 minute timeout
        this.locks.delete(lockKey);
      } else {
        return {
          acquired: false,
          lockedBy: existingLock.userId,
          reason: 'Section is locked by another user',
          expiresAt: new Date(existingLock.acquiredAt.getTime() + 5 * 60 * 1000)
        };
      }
    }

    // Acquire lock
    const lock = {
      userId,
      type,
      sectionId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    };

    this.locks.set(lockKey, lock);

    return {
      acquired: true,
      lock,
      expiresAt: lock.expiresAt
    };
  }

  /**
   * Release lock
   */
  async releaseLock(contractId, sectionId, userId) {
    const lockKey = `${contractId}:${sectionId}`;
    const lock = this.locks.get(lockKey);

    if (lock && lock.userId === userId) {
      this.locks.delete(lockKey);
      return true;
    }

    return false;
  }

  /**
   * Release all locks for a user in a contract
   */
  async releaseAllLocks(contractId, userId) {
    const keysToDelete = [];
    
    for (const [key, lock] of this.locks.entries()) {
      if (key.startsWith(contractId) && lock.userId === userId) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.locks.delete(key));
    return keysToDelete.length;
  }

  /**
   * Get active collaborators
   */
  async getActiveCollaborators(contractId) {
    const userIds = this.activeSessions.get(contractId) || new Set();
    
    if (userIds.size === 0) {
      return [];
    }

    const users = await User.find({ _id: { $in: Array.from(userIds) } })
      .select('name email profilePicture role');

    return users.map(user => ({
      ...user.toObject(),
      isActive: true,
      lastSeen: new Date()
    }));
  }

  /**
   * Add active collaborator
   */
  addActiveCollaborator(contractId, userId) {
    if (!this.activeSessions.has(contractId)) {
      this.activeSessions.set(contractId, new Set());
    }
    this.activeSessions.get(contractId).add(userId);
  }

  /**
   * Remove active collaborator
   */
  removeActiveCollaborator(contractId, userId) {
    const session = this.activeSessions.get(contractId);
    if (session) {
      session.delete(userId);
      if (session.size === 0) {
        this.activeSessions.delete(contractId);
        // Clean up document state after delay
        setTimeout(() => {
          if (!this.activeSessions.has(contractId)) {
            this.documentStates.delete(contractId);
            this.operationQueue.delete(contractId);
          }
        }, 5 * 60 * 1000); // 5 minutes
      }
    }
  }

  /**
   * Save contract with conflict resolution
   */
  async saveContract(contractId, userId) {
    try {
      const state = this.documentStates.get(contractId);
      if (!state) {
        throw new Error('No active session for this contract');
      }

      // Get contract from database
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Check for conflicts
      const dbChecksum = this.calculateChecksum(contract.content);
      const stateChecksum = this.calculateChecksum(state.content);

      if (contract.version > state.version) {
        // Database has newer version - need to merge
        const merged = await this.mergeContents(contract.content, state.content);
        state.content = merged;
        state.version = contract.version + 1;
      }

      // Save to database
      contract.content = state.content;
      contract.version = state.version;
      contract.lastModifiedBy = userId;
      await contract.save();

      // Create version history entry
      await contract.createVersion(userId, 'Collaborative edit');

      return {
        version: contract.version,
        timestamp: contract.updatedAt
      };
    } catch (error) {
      logger.error('Failed to save contract:', error);
      throw error;
    }
  }

  /**
   * Auto-save scheduling
   */
  async scheduleAutoSave(contractId, delay = 30000) {
    // Debounce auto-save
    if (this.autoSaveTimers && this.autoSaveTimers[contractId]) {
      clearTimeout(this.autoSaveTimers[contractId]);
    }

    if (!this.autoSaveTimers) {
      this.autoSaveTimers = {};
    }

    this.autoSaveTimers[contractId] = setTimeout(async () => {
      try {
        const session = this.activeSessions.get(contractId);
        if (session && session.size > 0) {
          const userId = Array.from(session)[0]; // Use first active user
          await this.saveContract(contractId, userId);
          logger.info(`Auto-saved contract ${contractId}`);
        }
      } catch (error) {
        logger.error(`Auto-save failed for contract ${contractId}:`, error);
      }
    }, delay);
  }

  /**
   * Get version history
   */
  async getVersion(contractId, version) {
    const ContractVersion = require('../models/ContractVersion');
    
    const versionData = await ContractVersion.findOne({
      contract: contractId,
      version
    });

    if (!versionData) {
      throw new Error('Version not found');
    }

    return versionData;
  }

  /**
   * Merge two content versions
   */
  async mergeContents(content1, content2) {
    // Use diff-match-patch for merging
    const patches = this.dmp.patch_make(content1, content2);
    const [merged, results] = this.dmp.patch_apply(patches, content1);
    
    // Check if all patches applied successfully
    const allSuccess = results.every(r => r);
    if (!allSuccess) {
      logger.warn('Some patches failed to apply during merge');
    }

    return merged;
  }

  /**
   * Calculate content checksum
   */
  calculateChecksum(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get collaboration metrics
   */
  async getMetrics(contractId) {
    const session = this.activeSessions.get(contractId);
    const queue = this.operationQueue.get(contractId) || [];
    
    // Calculate edit frequency
    const recentOps = queue.filter(op => 
      new Date() - op.timestamp < 60 * 60 * 1000 // Last hour
    );

    const userEdits = recentOps.reduce((acc, op) => {
      acc[op.userId] = (acc[op.userId] || 0) + 1;
      return acc;
    }, {});

    return {
      activeUsers: session ? session.size : 0,
      totalEdits: queue.length,
      recentEdits: recentOps.length,
      userContributions: userEdits,
      documentVersion: this.documentStates.get(contractId)?.version || 0
    };
  }

  /**
   * Export collaboration history
   */
  async exportHistory(contractId) {
    const queue = this.operationQueue.get(contractId) || [];
    const activities = await Activity.find({
      resource: 'Contract',
      resourceId: contractId,
      action: { $in: ['contract.edited', 'contract.commented', 'contract.signed'] }
    }).populate('user', 'name email').sort({ createdAt: -1 });

    return {
      operations: queue,
      activities: activities,
      exportedAt: new Date()
    };
  }
}

module.exports = CollaborationService;