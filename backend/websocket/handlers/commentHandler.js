const logger = require('../../utils/logger');
const Comment = require('../../models/Comment');
const Contract = require('../../models/Contract');
const { NotificationService } = require('../../services/notificationService');

class CommentHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.notificationService = new NotificationService();
  }

  async handleAddComment({ contractId, content, position, parentId, mentions }) {
    try {
      // Verify contract access
      const contract = await Contract.findById(contractId);
      if (!contract || !contract.hasAccess(this.socket.userId)) {
        throw new Error('Access denied');
      }

      // Create comment
      const comment = await Comment.create({
        contract: contractId,
        author: this.socket.userId,
        content,
        position,
        parentComment: parentId,
        mentions: mentions || []
      });

      // Populate author details
      await comment.populate('author', 'name email profilePicture');
      
      if (parentId) {
        await comment.populate('parentComment', 'author content');
      }

      // Emit to all users in contract
      const room = `contract:${contractId}`;
      this.io.to(room).emit('comment:added', {
        comment: comment.toJSON(),
        timestamp: new Date()
      });

      // Send notifications
      await this.notificationService.notifyNewComment(comment, contract);

      // Handle mentions
      if (mentions && mentions.length > 0) {
        await this.notificationService.notifyMentions(comment, mentions);
      }

      logger.info(`Comment added to contract ${contractId} by user ${this.socket.userId}`);
    } catch (error) {
      logger.error('Error adding comment:', error);
      this.socket.emit('comment:error', {
        action: 'add',
        error: error.message
      });
    }
  }

  async handleUpdateComment({ commentId, content }) {
    try {
      // Find and verify ownership
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      if (comment.author.toString() !== this.socket.userId) {
        throw new Error('Unauthorized to edit this comment');
      }

      // Update comment
      comment.content = content;
      comment.isEdited = true;
      comment.editedAt = new Date();
      await comment.save();

      // Emit to all users in contract
      const room = `contract:${comment.contract}`;
      this.io.to(room).emit('comment:updated', {
        commentId,
        content,
        editedAt: comment.editedAt,
        timestamp: new Date()
      });

      logger.info(`Comment ${commentId} updated by user ${this.socket.userId}`);
    } catch (error) {
      logger.error('Error updating comment:', error);
      this.socket.emit('comment:error', {
        action: 'update',
        error: error.message
      });
    }
  }

  async handleDeleteComment({ commentId }) {
    try {
      // Find and verify ownership
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      const contractId = comment.contract;
      
      // Check if user can delete (owner or contract owner)
      const contract = await Contract.findById(contractId);
      const canDelete = comment.author.toString() === this.socket.userId ||
                       contract.owner.toString() === this.socket.userId ||
                       this.socket.user.role === 'admin';

      if (!canDelete) {
        throw new Error('Unauthorized to delete this comment');
      }

      // Soft delete to preserve thread structure
      comment.isDeleted = true;
      comment.deletedAt = new Date();
      comment.deletedBy = this.socket.userId;
      await comment.save();

      // Emit to all users in contract
      const room = `contract:${contractId}`;
      this.io.to(room).emit('comment:deleted', {
        commentId,
        deletedBy: this.socket.userId,
        timestamp: new Date()
      });

      logger.info(`Comment ${commentId} deleted by user ${this.socket.userId}`);
    } catch (error) {
      logger.error('Error deleting comment:', error);
      this.socket.emit('comment:error', {
        action: 'delete',
        error: error.message
      });
    }
  }

  async handleResolveComment({ commentId, resolved }) {
    try {
      // Find comment and verify access
      const comment = await Comment.findById(commentId)
        .populate('contract', 'owner collaborators');
      
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Check if user can resolve (contract participant)
      const contract = comment.contract;
      const canResolve = contract.owner.toString() === this.socket.userId ||
                        contract.collaborators.includes(this.socket.userId);

      if (!canResolve) {
        throw new Error('Unauthorized to resolve this comment');
      }

      // Update resolution status
      comment.isResolved = resolved;
      comment.resolvedAt = resolved ? new Date() : null;
      comment.resolvedBy = resolved ? this.socket.userId : null;
      await comment.save();

      // Emit to all users in contract
      const room = `contract:${contract._id}`;
      this.io.to(room).emit('comment:resolved', {
        commentId,
        resolved,
        resolvedBy: resolved ? {
          id: this.socket.userId,
          name: this.socket.user.name
        } : null,
        timestamp: new Date()
      });

      // Notify comment author
      if (resolved && comment.author.toString() !== this.socket.userId) {
        await this.notificationService.notifyCommentResolved(comment, this.socket.user);
      }

      logger.info(`Comment ${commentId} ${resolved ? 'resolved' : 'unresolved'} by user ${this.socket.userId}`);
    } catch (error) {
      logger.error('Error resolving comment:', error);
      this.socket.emit('comment:error', {
        action: 'resolve',
        error: error.message
      });
    }
  }

  async handleAddReaction({ commentId, reaction }) {
    try {
      // Find comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Add or update reaction
      const existingReactionIndex = comment.reactions.findIndex(
        r => r.user.toString() === this.socket.userId
      );

      if (existingReactionIndex > -1) {
        // Update existing reaction
        comment.reactions[existingReactionIndex].type = reaction;
      } else {
        // Add new reaction
        comment.reactions.push({
          user: this.socket.userId,
          type: reaction
        });
      }

      await comment.save();

      // Emit to all users in contract
      const room = `contract:${comment.contract}`;
      this.io.to(room).emit('comment:reaction-added', {
        commentId,
        userId: this.socket.userId,
        reaction,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error adding reaction:', error);
      this.socket.emit('comment:error', {
        action: 'react',
        error: error.message
      });
    }
  }

  async handleRemoveReaction({ commentId }) {
    try {
      // Find comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Remove reaction
      comment.reactions = comment.reactions.filter(
        r => r.user.toString() !== this.socket.userId
      );

      await comment.save();

      // Emit to all users in contract
      const room = `contract:${comment.contract}`;
      this.io.to(room).emit('comment:reaction-removed', {
        commentId,
        userId: this.socket.userId,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error removing reaction:', error);
      this.socket.emit('comment:error', {
        action: 'remove-react',
        error: error.message
      });
    }
  }

  async handleTypingStart({ contractId, commentId }) {
    const room = `contract:${contractId}`;
    
    this.socket.to(room).emit('comment:typing-start', {
      userId: this.socket.userId,
      user: {
        name: this.socket.user.name,
        profilePicture: this.socket.user.profilePicture
      },
      commentId,
      timestamp: new Date()
    });
  }

  async handleTypingStop({ contractId, commentId }) {
    const room = `contract:${contractId}`;
    
    this.socket.to(room).emit('comment:typing-stop', {
      userId: this.socket.userId,
      commentId,
      timestamp: new Date()
    });
  }
}

module.exports = CommentHandler;