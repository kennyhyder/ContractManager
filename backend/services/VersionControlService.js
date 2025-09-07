const { Contract } = require('../models');
const FileService = require('./FileService');
const logger = require('../utils/logger');
const diff = require('diff');
const crypto = require('crypto');

class VersionControlService {
  /**
   * Create a new version
   */
  async createVersion(contractId, versionData) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Get current version number
      const currentVersion = contract.versions.length > 0
        ? contract.versions[contract.versions.length - 1].version
        : '0.0.0';

      const newVersion = this.incrementVersion(currentVersion, versionData.type || 'patch');

      // Create version object
      const version = {
        version: newVersion,
        content: versionData.content,
        changes: versionData.changes || this.generateChangeSummary(contract.content, versionData.content),
        createdBy: versionData.userId,
        message: versionData.message || `Version ${newVersion}`,
        hash: this.generateContentHash(versionData.content)
      };

      // Check if content actually changed
      if (contract.versions.length > 0) {
        const lastVersion = contract.versions[contract.versions.length - 1];
        if (lastVersion.hash === version.hash) {
          throw new Error('No changes detected');
        }
      }

      // Add version to contract
      contract.versions.push(version);
      contract.currentVersion = newVersion;
      contract.content = versionData.content;
      
      await contract.save();

      logger.info(`Created version ${newVersion} for contract ${contractId}`);

      return version;
    } catch (error) {
      logger.error('Create version error:', error);
      throw error;
    }
  }

  /**
   * Get version history
   */
  async getVersions(contractId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;

      const contract = await Contract.findById(contractId)
        .populate('versions.createdBy', 'firstName lastName email avatar')
        .select('versions currentVersion');

      if (!contract) {
        throw new Error('Contract not found');
      }

      const start = (page - 1) * limit;
      const end = start + limit;

      const versions = contract.versions
        .slice()
        .reverse()
        .slice(start, end);

      return {
        versions,
        currentVersion: contract.currentVersion,
        pagination: {
          page,
          limit,
          total: contract.versions.length,
          pages: Math.ceil(contract.versions.length / limit)
        }
      };
    } catch (error) {
      logger.error('Get versions error:', error);
      throw error;
    }
  }

  /**
   * Get specific version
   */
  async getVersion(contractId, version) {
    try {
      const contract = await Contract.findById(contractId)
        .populate('versions.createdBy', 'firstName lastName email avatar');

      if (!contract) {
        throw new Error('Contract not found');
      }

      const versionData = contract.versions.find(v => v.version === version);
      if (!versionData) {
        throw new Error('Version not found');
      }

      return versionData;
    } catch (error) {
      logger.error('Get version error:', error);
      throw error;
    }
  }

  /**
   * Compare versions
   */
  async compareVersions(contractId, version1, version2) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      const v1 = contract.versions.find(v => v.version === version1);
      const v2 = contract.versions.find(v => v.version === version2);

      if (!v1 || !v2) {
        throw new Error('Version not found');
      }

      const changes = diff.diffLines(v1.content, v2.content);
      
      return {
        version1: {
          version: v1.version,
          createdAt: v1.createdAt,
          createdBy: v1.createdBy
        },
        version2: {
          version: v2.version,
          createdAt: v2.createdAt,
          createdBy: v2.createdBy
        },
        changes: changes.map(change => ({
          type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
          value: change.value,
          count: change.count
        })),
        summary: {
          additions: changes.filter(c => c.added).reduce((sum, c) => sum + c.count, 0),
          deletions: changes.filter(c => c.removed).reduce((sum, c) => sum + c.count, 0)
        }
      };
    } catch (error) {
      logger.error('Compare versions error:', error);
      throw error;
    }
  }

  /**
   * Restore version
   */
  async restoreVersion(contractId, version, userId) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      const versionData = contract.versions.find(v => v.version === version);
      if (!versionData) {
        throw new Error('Version not found');
      }

      // Create new version with restored content
      await this.createVersion(contractId, {
        content: versionData.content,
        userId,
        message: `Restored from version ${version}`,
        type: 'minor'
      });

      return { success: true };
    } catch (error) {
      logger.error('Restore version error:', error);
      throw error;
    }
  }

  /**
   * Create branch
   */
  async createBranch(contractId, branchName, userId) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Check if branch exists
      if (contract.branches && contract.branches.has(branchName)) {
        throw new Error('Branch already exists');
      }

      if (!contract.branches) {
        contract.branches = new Map();
      }

      // Create branch with current content
      contract.branches.set(branchName, {
        content: contract.content,
        version: contract.currentVersion,
        createdBy: userId,
        createdAt: new Date(),
        lastModified: new Date()
      });

      await contract.save();

      logger.info(`Created branch ${branchName} for contract ${contractId}`);

      return { success: true, branch: branchName };
    } catch (error) {
      logger.error('Create branch error:', error);
      throw error;
    }
  }

  /**
   * Merge branch
   */
  async mergeBranch(contractId, branchName, userId, options = {}) {
    try {
      const { conflictResolution = 'manual' } = options;

      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      const branch = contract.branches?.get(branchName);
      if (!branch) {
        throw new Error('Branch not found');
      }

      // Check for conflicts
      const conflicts = this.detectConflicts(contract.content, branch.content);

      if (conflicts.length > 0 && conflictResolution === 'manual') {
        return {
          hasConflicts: true,
          conflicts
        };
      }

      // Auto-resolve or no conflicts
      const mergedContent = conflictResolution === 'theirs'
        ? branch.content
        : conflictResolution === 'ours'
        ? contract.content
        : this.autoMerge(contract.content, branch.content);

      // Create new version with merged content
      await this.createVersion(contractId, {
        content: mergedContent,
        userId,
        message: `Merged branch ${branchName}`,
        type: 'minor'
      });

      // Delete branch after merge
      contract.branches.delete(branchName);
      await contract.save();

      return { success: true, merged: true };
    } catch (error) {
      logger.error('Merge branch error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  incrementVersion(version, type = 'patch') {
    const parts = version.split('.').map(Number);
    
    switch (type) {
      case 'major':
        return `${parts[0] + 1}.0.0`;
      case 'minor':
        return `${parts[0]}.${parts[1] + 1}.0`;
      case 'patch':
      default:
        return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    }
  }

  generateContentHash(content) {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  generateChangeSummary(oldContent, newContent) {
    const changes = diff.diffLines(oldContent, newContent);
    
    return {
      additions: changes.filter(c => c.added).length,
      deletions: changes.filter(c => c.removed).length,
      modifications: changes.filter(c => !c.added && !c.removed && c.value.trim()).length
    };
  }

  detectConflicts(content1, content2) {
    // Simple conflict detection
    // In a real implementation, this would be more sophisticated
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    const conflicts = [];

    const maxLength = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (lines1[i] !== lines2[i] && lines1[i] && lines2[i]) {
        conflicts.push({
          line: i + 1,
          current: lines1[i],
          incoming: lines2[i]
        });
      }
    }

    return conflicts;
  }

  autoMerge(content1, content2) {
    // Simple auto-merge strategy
    // In production, use a proper 3-way merge algorithm
    const changes = diff.diffLines(content1, content2);
    let merged = '';

    changes.forEach(change => {
      if (!change.removed) {
        merged += change.value;
      }
    });

    return merged;
  }
}

module.exports = new VersionControlService();