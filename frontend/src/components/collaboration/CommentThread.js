import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';
import './CommentThread.css';

function CommentThread({ contractId, section, onClose }) {
  const { user } = useSelector((state) => state.auth);
  const { socket, connected } = useWebSocket();
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadComments();
    
    if (connected && socket) {
      socket.on('comment:added', handleCommentAdded);
      socket.on('comment:updated', handleCommentUpdated);
      socket.on('comment:deleted', handleCommentDeleted);

      return () => {
        socket.off('comment:added');
        socket.off('comment:updated');
        socket.off('comment:deleted');
      };
    }
  }, [connected, socket, contractId, section]);

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadComments = async () => {
    try {
      const params = new URLSearchParams({
        contractId,
        ...(section && { section })
      });
      
      const response = await fetch(`/api/comments?${params}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load comments');
      
      const data = await response.json();
      setComments(data.comments);
    } catch (error) {
      console.error('Failed to load comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleCommentAdded = (comment) => {
    if (comment.contract === contractId && (!section || comment.section === section)) {
      setComments(prev => [...prev, comment]);
    }
  };

  const handleCommentUpdated = (updatedComment) => {
    setComments(prev => prev.map(comment => 
      comment._id === updatedComment._id ? updatedComment : comment
    ));
  };

  const handleCommentDeleted = (commentId) => {
    setComments(prev => prev.filter(comment => comment._id !== commentId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newComment.trim()) return;

    try {
      const commentData = {
        contract: contractId,
        content: newComment.trim(),
        section,
        parentComment: replyTo?._id,
      };

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(commentData),
      });

      if (!response.ok) throw new Error('Failed to add comment');

      setNewComment('');
      setReplyTo(null);
      
      // Socket will handle the update
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleEdit = async (commentId, newContent) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ content: newContent }),
      });

      if (!response.ok) throw new Error('Failed to update comment');

      setEditingComment(null);
      // Socket will handle the update
    } catch (error) {
      toast.error('Failed to update comment');
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete comment');

      // Socket will handle the update
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const handleResolve = async (commentId) => {
    try {
      const response = await fetch(`/api/comments/${commentId}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to resolve comment');

      // Socket will handle the update
    } catch (error) {
      toast.error('Failed to resolve comment');
    }
  };

  const renderComment = (comment, isReply = false) => {
    const isAuthor = comment.author._id === user._id;
    const isEditing = editingComment === comment._id;

    return (
      <div key={comment._id} className={`comment ${isReply ? 'reply' : ''} ${comment.resolved ? 'resolved' : ''}`}>
        <div className="comment-header">
          <div className="author-info">
            <div className="author-avatar">
              {comment.author.name.charAt(0).toUpperCase()}
            </div>
            <span className="author-name">{comment.author.name}</span>
          </div>
          <span className="comment-time">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>

        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const content = e.target.content.value;
              handleEdit(comment._id, content);
            }}
            className="edit-form"
          >
            <textarea
              name="content"
              defaultValue={comment.content}
              className="edit-input"
              autoFocus
            />
            <div className="edit-actions">
              <button type="submit" className="btn btn-sm btn-primary">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingComment(null)}
                className="btn btn-sm btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="comment-content">
              {comment.content}
              {comment.edited && (
                <span className="edited-label">(edited)</span>
              )}
            </div>

            <div className="comment-actions">
              {!comment.resolved && !isReply && (
                <button
                  onClick={() => setReplyTo(comment)}
                  className="action-btn"
                >
                  Reply
                </button>
              )}
              
              {isAuthor && !comment.resolved && (
                <>
                  <button
                    onClick={() => setEditingComment(comment._id)}
                    className="action-btn"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(comment._id)}
                    className="action-btn danger"
                  >
                    Delete
                  </button>
                </>
              )}
              
              {!isReply && !comment.resolved && (
                <button
                  onClick={() => handleResolve(comment._id)}
                  className="action-btn success"
                >
                  Resolve
                </button>
              )}
            </div>
          </>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="replies">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}

        {replyTo?._id === comment._id && (
          <form onSubmit={handleSubmit} className="reply-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a reply..."
              className="reply-input"
              autoFocus
            />
            <div className="reply-actions">
              <button type="submit" className="btn btn-sm btn-primary">
                Reply
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  setNewComment('');
                }}
                className="btn btn-sm btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="comment-thread-loading">Loading comments...</div>;
  }

  return (
    <div className="comment-thread">
      <div className="thread-header">
        <h3>
          Comments
          {section && <span className="section-label">on {section}</span>}
        </h3>
        {onClose && (
          <button onClick={onClose} className="close-button">
            ×
          </button>
        )}
      </div>

      <div className="comments-list">
        {comments.length === 0 ? (
          <div className="no-comments">
            <p>No comments yet</p>
            <p>Be the first to comment on this {section || 'contract'}</p>
          </div>
        ) : (
          <>
            {comments
              .filter(comment => !comment.parentComment)
              .map(comment => renderComment(comment))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="comment-form">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={replyTo ? `Reply to ${replyTo.author.name}...` : 'Add a comment...'}
          className="comment-input"
          rows={3}
        />
        <div className="form-actions">
          {replyTo && (
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setNewComment('');
              }}
              className="btn btn-secondary"
            >
              Cancel Reply
            </button>
          )}
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="btn btn-primary"
          >
            {replyTo ? 'Reply' : 'Comment'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CommentThread;