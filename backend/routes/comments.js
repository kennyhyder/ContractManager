const express = require('express');
const router = express.Router();
const { Comment, Contract, Activity, Notification } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validateComment } = require('../middleware/validation');
const NotificationService = require('../services/NotificationService');
const logger = require('../utils/logger');

/**
 * @route   GET /api/comments/contract/:contractId
 * @desc    Get comments for a contract
 * @access  Private
 */
router.get('/contract/:contractId', authMiddleware, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { threadId, resolved, page = 1, limit = 20 } = req.query;

    // Check contract access
    const contract = await Contract.findById(contractId);
    if (!contract || !contract.hasAccess(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Build query
    const query = { 
      contract: contractId, 
      isDeleted: false 
    };

    if (threadId) {
      query.$or = [
        { _id: threadId },
        { thread: threadId }
      ];
    }

    if (resolved !== undefined) {
      query.resolved = resolved === 'true';
    }

    // Get comments
    const comments = await Comment
      .find(query)
      .populate('author', 'firstName lastName avatar')
      .populate('mentions.user', 'firstName lastName')
      .populate('replies')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Comment.countDocuments(query);

    res.json({
      success: true,
      data: {
        comments,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get comments error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch comments' 
    });
  }
});

/**
 * @route   POST /api/comments
 * @desc    Create comment
 * @access  Private
 */
router.post('/', authMiddleware, validateComment.create, async (req, res) => {
  try {
    const { contractId, text, type, position, parentId, attachments } = req.body;

    // Check contract access
    const contract = await Contract.findById(contractId);
    if (!contract || !contract.hasAccess(req.user._id, 'comment')) {
      return res.status(403).json({ 
        success: false,
        message: 'You do not have permission to comment on this contract' 
      });
    }

    // Create comment
    const comment = new Comment({
      contract: contractId,
      author: req.user._id,
      text,
      type: type || 'general',
      position,
      attachments,
      parent: parentId
    });

    // Set thread if reply
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (parentComment) {
        comment.thread = parentComment.thread || parentComment._id;
        
        // Add to parent's replies
        parentComment.replies.push(comment._id);
        await parentComment.save();
      }
    }

    await comment.save();

    // Populate author info
    await comment.populate('author', 'firstName lastName avatar');

    // Send notifications for mentions
    if (comment.mentions.length > 0) {
      for (const mention of comment.mentions) {
        if (!mention.user.equals(req.user._id)) {
          await NotificationService.createNotification({
            user: mention.user,
            type: 'comment_mention',
            title: 'You were mentioned in a comment',
            message: `${req.user.firstName} mentioned you in a comment on "${contract.title}"`,
            resource: { type: 'comment', id: comment._id },
            from: req.user._id,
            actionUrl: `/contracts/${contractId}#comment-${comment._id}`,
            actionLabel: 'View Comment'
          });
        }
      }
    }

    // Notify contract owner and collaborators
    const notifyUsers = [contract.owner, ...contract.collaborators.map(c => c.user)];
    const uniqueUsers = [...new Set(notifyUsers.map(u => u.toString()))]
      .filter(userId => userId !== req.user._id.toString());

    for (const userId of uniqueUsers) {
      await NotificationService.createNotification({
        user: userId,
        type: 'comment_added',
        title: 'New comment on contract',
        message: `${req.user.firstName} commented on "${contract.title}"`,
        resource: { type: 'comment', id: comment._id },
        from: req.user._id,
        actionUrl: `/contracts/${contractId}#comment-${comment._id}`,
        actionLabel: 'View Comment'
      });
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'comment.created',
      resource: { type: 'comment', id: comment._id },
      details: {
        contractId,
        type: comment.type
      }
    });

    // Emit real-time event
    req.app.get('io').to(`contract:${contractId}`).emit('comment:created', {
      comment,
      contractId
    });

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comment }
    });
  } catch (error) {
    logger.error('Create comment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create comment' 
    });
  }
});

/**
 * @route   PUT /api/comments/:id
 * @desc    Update comment
 * @access  Private
 */
router.put('/:id', authMiddleware, validateComment.update, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment || comment.isDeleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Comment not found' 
      });
    }

    // Check if user is author
    if (!comment.author.equals(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'You can only edit your own comments' 
      });
    }

    // Update comment
    await comment.edit(req.body.text, req.user._id);

    // Emit real-time event
    req.app.get('io').to(`contract:${comment.contract}`).emit('comment:updated', {
      commentId: comment._id,
      text: comment.text,
      edited: true
    });

    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: { comment }
    });
  } catch (error) {
    logger.error('Update comment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update comment' 
    });
  }
});

/**
 * @route   DELETE /api/comments/:id
 * @desc    Delete comment
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment || comment.isDeleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Comment not found' 
      });
    }

    // Check if user is author or admin
    if (!comment.author.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'You can only delete your own comments' 
      });
    }

    // Soft delete
    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.deletedBy = req.user._id;
    await comment.save();

    // Emit real-time event
    req.app.get('io').to(`contract:${comment.contract}`).emit('comment:deleted', {
      commentId: comment._id
    });

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    logger.error('Delete comment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete comment' 
    });
  }
});

/**
 * @route   POST /api/comments/:id/resolve
 * @desc    Resolve comment
 * @access  Private
 */
router.post('/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment || comment.isDeleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Comment not found' 
      });
    }

    // Check contract access
    const contract = await Contract.findById(comment.contract);
    if (!contract || !contract.hasAccess(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Resolve comment
    await comment.resolve(req.user._id);

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'comment.resolved',
      resource: { type: 'comment', id: comment._id }
    });

    // Emit real-time event
    req.app.get('io').to(`contract:${comment.contract}`).emit('comment:resolved', {
      commentId: comment._id,
      resolvedBy: req.user._id
    });

    res.json({
      success: true,
      message: 'Comment resolved successfully',
      data: { comment }
    });
  } catch (error) {
    logger.error('Resolve comment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to resolve comment' 
    });
  }
});

/**
 * @route   POST /api/comments/:id/reaction
 * @desc    Add reaction to comment
 * @access  Private
 */
router.post('/:id/reaction', authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ 
        success: false,
        message: 'Emoji is required' 
      });
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment || comment.isDeleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Comment not found' 
      });
    }

    // Toggle reaction
    const hasReaction = comment.reactions.get(emoji)?.includes(req.user._id);
    
    if (hasReaction) {
      await comment.removeReaction(req.user._id, emoji);
    } else {
      await comment.addReaction(req.user._id, emoji);
    }

    // Emit real-time event
    req.app.get('io').to(`contract:${comment.contract}`).emit('comment:reaction', {
      commentId: comment._id,
      reactions: comment.reactions
    });

    res.json({
      success: true,
      message: hasReaction ? 'Reaction removed' : 'Reaction added',
      data: { 
        reactions: comment.reactions 
      }
    });
  } catch (error) {
    logger.error('Add reaction error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to add reaction' 
    });
  }
});

module.exports = router;