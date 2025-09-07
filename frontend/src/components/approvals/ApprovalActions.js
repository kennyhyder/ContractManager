import React, { useState } from 'react';
import './ApprovalActions.css';

function ApprovalActions({ approvalId, onApprove, onReject, disabled = false }) {
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [action, setAction] = useState(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = (actionType) => {
    setAction(actionType);
    setShowCommentModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!comment.trim() && action === 'reject') {
      alert('Please provide a reason for rejection');
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (action === 'approve') {
        await onApprove(comment);
      } else {
        await onReject(comment);
      }
      
      setShowCommentModal(false);
      setComment('');
    } catch (error) {
      console.error('Failed to submit approval action:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowCommentModal(false);
    setComment('');
    setAction(null);
  };

  return (
    <>
      <div className="approval-actions">
        <button
          onClick={() => handleAction('approve')}
          disabled={disabled}
          className="btn btn-success"
        >
          Approve
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={disabled}
          className="btn btn-danger"
        >
          Reject
        </button>
      </div>

      {showCommentModal && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              {action === 'approve' ? 'Approve' : 'Reject'} Contract
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Comment {action === 'reject' && <span className="required">*</span>}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    action === 'approve' 
                      ? 'Add an optional comment...' 
                      : 'Please provide a reason for rejection...'
                  }
                  rows={4}
                  className="form-control"
                  required={action === 'reject'}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`btn btn-${action === 'approve' ? 'success' : 'danger'}`}
                >
                  {isSubmitting ? 'Submitting...' : action === 'approve' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default ApprovalActions;