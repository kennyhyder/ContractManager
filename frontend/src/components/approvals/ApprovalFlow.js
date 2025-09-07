import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ApprovalStatus from './ApprovalStatus';
import ApprovalActions from './ApprovalActions';
import Loading from '../common/Loading';
import './ApprovalFlow.css';

function ApprovalFlow() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [approvals, setApprovals] = useState({
    pending: [],
    completed: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    priority: '',
  });

  useEffect(() => {
    loadApprovals();
  }, [filters]);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`/api/approvals?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load approvals');
      
      const data = await response.json();
      setApprovals({
        pending: data.approvals.filter(a => a.status === 'pending'),
        completed: data.approvals.filter(a => a.status !== 'pending'),
      });
    } catch (error) {
      console.error('Failed to load approvals:', error);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async (approvalId, action, comment) => {
    try {
      const response = await fetch(`/api/approvals/${approvalId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ comment }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} approval`);

      toast.success(`Contract ${action}ed successfully`);
      loadApprovals();
    } catch (error) {
      toast.error(`Failed to ${action} contract`);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'red';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getTimeRemaining = (deadline) => {
    if (!deadline) return null;
    
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate - now;
    
    if (diff < 0) return 'Overdue';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days remaining`;
    if (hours > 0) return `${hours} hours remaining`;
    return 'Due soon';
  };

  if (loading) {
    return <Loading fullscreen />;
  }

  const currentApprovals = activeTab === 'pending' ? approvals.pending : approvals.completed;

  return (
    <div className="approval-flow-container">
      <div className="page-header">
        <h1>Approval Queue</h1>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-value">{approvals.pending.length}</span>
            <span className="stat-label">Pending</span>
          </div>
          <div className="stat">
            <span className="stat-value">{approvals.completed.length}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
      </div>

      <div className="approval-filters">
        <input
          type="search"
          placeholder="Search approvals..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="search-input"
        />

        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="filter-select"
        >
          <option value="">All Types</option>
          <option value="contract">Contracts</option>
          <option value="amendment">Amendments</option>
          <option value="renewal">Renewals</option>
        </select>

        <select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          className="filter-select"
        >
          <option value="">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>
      </div>

      <div className="approval-tabs">
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({approvals.pending.length})
        </button>
        <button
          className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({approvals.completed.length})
        </button>
      </div>

      <div className="approvals-list">
        {currentApprovals.map((approval) => (
          <div key={approval._id} className="approval-card">
            <div className="approval-header">
              <div className="approval-title">
                <h3>{approval.contract.title}</h3>
                <span className={`priority-badge priority-${getPriorityColor(approval.priority)}`}>
                  {approval.priority} priority
                </span>
              </div>
              
              {approval.deadline && (
                <span className={`deadline ${approval.status === 'pending' && new Date(approval.deadline) < new Date() ? 'overdue' : ''}`}>
                  {getTimeRemaining(approval.deadline)}
                </span>
              )}
            </div>

            <div className="approval-info">
              <div className="info-row">
                <span className="label">Requested by:</span>
                <span className="value">{approval.requestedBy.name}</span>
              </div>
              <div className="info-row">
                <span className="label">Contract Type:</span>
                <span className="value">{approval.contract.type}</span>
              </div>
              <div className="info-row">
                <span className="label">Value:</span>
                <span className="value">
                  {approval.contract.value 
                    ? `$${approval.contract.value.toLocaleString()}`
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="info-row">
                <span className="label">Requested:</span>
                <span className="value">
                  {new Date(approval.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {approval.notes && (
              <div className="approval-notes">
                <p>{approval.notes}</p>
              </div>
            )}

            <div className="approval-footer">
              <button
                onClick={() => navigate(`/contracts/${approval.contract._id}`)}
                className="btn btn-secondary"
              >
                View Contract
              </button>
              
              {approval.status === 'pending' ? (
                <ApprovalActions
                  approvalId={approval._id}
                  onApprove={(comment) => handleApprovalAction(approval._id, 'approve', comment)}
                  onReject={(comment) => handleApprovalAction(approval._id, 'reject', comment)}
                />
              ) : (
                <div className={`status-badge status-${approval.status}`}>
                  {approval.status}
                  {approval.approvedBy && (
                    <span className="approver">
                      by {approval.approvedBy.name}
                    </span>
                  )}
                </div>
              )}
            </div>

            {approval.comments && approval.comments.length > 0 && (
              <div className="approval-comments">
                <h4>Comments</h4>
                {approval.comments.map((comment, index) => (
                  <div key={index} className="comment">
                    <strong>{comment.author.name}:</strong> {comment.text}
                    <span className="comment-time">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {currentApprovals.length === 0 && (
          <div className="empty-state">
            <p>No {activeTab} approvals</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApprovalFlow;