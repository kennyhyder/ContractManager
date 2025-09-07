import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import './ApprovalStatus.css';

function ApprovalStatus({ contractId }) {
  const { user } = useSelector((state) => state.auth);
  const [approvalData, setApprovalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadApprovalStatus();
  }, [contractId]);

  const loadApprovalStatus = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/approval-status`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load approval status');
      
      const data = await response.json();
      setApprovalData(data);
    } catch (error) {
      console.error('Failed to load approval status:', error);
      toast.error('Failed to load approval status');
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (step, currentStep) => {
    if (step.order < currentStep) return 'completed';
    if (step.order === currentStep) return 'current';
    return 'pending';
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'current':
        return '●';
      case 'pending':
        return '○';
      default:
        return '○';
    }
  };

  if (loading) {
    return <div className="approval-status-loading">Loading approval status...</div>;
  }

  if (!approvalData) {
    return (
      <div className="approval-status-empty">
        <p>No approval workflow configured for this contract</p>
      </div>
    );
  }

  const { workflow, currentStep, history } = approvalData;

  return (
    <div className="approval-status-container">
      <div className="approval-header">
        <h3>Approval Workflow</h3>
        <span className={`workflow-status status-${workflow.status}`}>
          {workflow.status}
        </span>
      </div>

      <div className="approval-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${(currentStep / workflow.steps.length) * 100}%` }}
          />
        </div>
        <div className="progress-text">
          Step {currentStep} of {workflow.steps.length}
        </div>
      </div>

      <div className="approval-steps">
        {workflow.steps.map((step, index) => {
          const status = getStepStatus(step, currentStep);
          const isActive = step.order === currentStep;
          
          return (
            <div 
              key={step._id} 
              className={`approval-step ${status} ${isActive ? 'active' : ''}`}
            >
              <div className="step-connector" />
              
              <div className="step-icon">
                {getStepIcon(status)}
              </div>
              
              <div className="step-content">
                <h4>{step.name}</h4>
                <p className="step-description">{step.description}</p>
                
                <div className="step-approvers">
                  <span className="label">Approvers:</span>
                  <div className="approvers-list">
                    {step.approvers.map((approver) => (
                      <span key={approver._id} className="approver-badge">
                        {approver.name}
                        {step.completedBy?.includes(approver._id) && (
                          <span className="approved-check">✓</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                
                {step.deadline && (
                  <div className="step-deadline">
                    <span className="label">Deadline:</span>
                    <span className="value">
                      {new Date(step.deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {status === 'completed' && step.completedAt && (
                  <div className="step-completed">
                    Completed on {new Date(step.completedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="approval-history-section">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="toggle-history-btn"
        >
          {showHistory ? 'Hide' : 'Show'} Approval History
          <span className="arrow">{showHistory ? '▲' : '▼'}</span>
        </button>
        
        {showHistory && history && history.length > 0 && (
          <div className="approval-history">
            {history.map((entry, index) => (
              <div key={index} className="history-entry">
                <div className="history-icon">
                  {entry.action === 'approved' ? '✓' : '✗'}
                </div>
                <div className="history-content">
                  <div className="history-header">
                    <strong>{entry.user.name}</strong>
                    <span className={`action ${entry.action}`}>
                      {entry.action}
                    </span>
                  </div>
                  {entry.comment && (
                    <p className="history-comment">{entry.comment}</p>
                  )}
                  <span className="history-time">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {workflow.notes && (
        <div className="workflow-notes">
          <h4>Notes</h4>
          <p>{workflow.notes}</p>
        </div>
      )}
    </div>
  );
}

export default ApprovalStatus;