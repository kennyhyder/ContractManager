import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchContract, updateContractStatus } from '../../store/contractSlice';
import ContractEditor from './ContractEditor';
import ContractVersions from './ContractVersions';
import CommentThread from '../collaboration/CommentThread';
import ApprovalStatus from '../approvals/ApprovalStatus';
import Loading from '../common/Loading';
import './ContractDetail.css';

function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentContract: contract, loading } = useSelector((state) => state.contracts);
  const { user } = useSelector((state) => state.auth);
  
  const [activeTab, setActiveTab] = useState('content');
  const [showVersions, setShowVersions] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(fetchContract(id));
    }
  }, [id, dispatch]);

  const handleStatusChange = async (newStatus) => {
    try {
      await dispatch(updateContractStatus({ id, status: newStatus })).unwrap();
      toast.success(`Contract ${newStatus} successfully`);
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const handleSign = async () => {
    // TODO: Implement digital signature
    setShowSignatureModal(true);
  };

  const handleExport = async (format) => {
    try {
      const response = await fetch(`/api/contracts/${id}/export?format=${format}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contract.title}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Contract exported successfully');
    } catch (error) {
      toast.error('Failed to export contract');
    }
  };

  const canEdit = user?.role === 'admin' || contract?.createdBy === user?._id;
  const canApprove = user?.role === 'approver' || user?.role === 'admin';
  const canSign = contract?.parties?.some(p => p.email === user?.email);

  if (loading) {
    return <Loading fullscreen />;
  }

  if (!contract) {
    return (
      <div className="error-container">
        <h2>Contract not found</h2>
        <Link to="/contracts">Back to contracts</Link>
      </div>
    );
  }

  return (
    <div className="contract-detail-container">
      <div className="contract-header">
        <div className="header-left">
          <Link to="/contracts" className="back-link">
            ← Back to contracts
          </Link>
          <h1>{contract.title}</h1>
          <div className="contract-meta">
            <span className={`status-badge status-${contract.status}`}>
              {contract.status}
            </span>
            <span className="contract-type">{contract.type}</span>
            <span className="contract-date">
              Created {new Date(contract.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <div className="header-actions">
          {canEdit && contract.status === 'draft' && (
            <Link to={`/contracts/${id}/edit`} className="btn btn-secondary">
              Edit
            </Link>
          )}
          
          {canApprove && contract.status === 'pending' && (
            <>
              <button
                className="btn btn-success"
                onClick={() => handleStatusChange('approved')}
              >
                Approve
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleStatusChange('rejected')}
              >
                Reject
              </button>
            </>
          )}
          
          {canSign && contract.status === 'approved' && (
            <button className="btn btn-primary" onClick={handleSign}>
              Sign Contract
            </button>
          )}
          
          <div className="dropdown">
            <button className="btn btn-secondary dropdown-toggle">
              Export
            </button>
            <div className="dropdown-menu">
              <button onClick={() => handleExport('pdf')}>Export as PDF</button>
              <button onClick={() => handleExport('docx')}>Export as Word</button>
            </div>
          </div>
        </div>
      </div>

      <div className="contract-tabs">
        <button
          className={`tab ${activeTab === 'content' ? 'active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          Content
        </button>
        <button
          className={`tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`tab ${activeTab === 'approval' ? 'active' : ''}`}
          onClick={() => setActiveTab('approval')}
        >
          Approval
        </button>
        <button
          className={`tab ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          Comments
        </button>
        <button
          className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
      </div>

      <div className="contract-content">
        {activeTab === 'content' && (
          <div className="content-section">
            <div className="content-actions">
              <button
                className="btn btn-link"
                onClick={() => setShowVersions(!showVersions)}
              >
                {showVersions ? 'Hide' : 'Show'} Version History
              </button>
            </div>
            
            {showVersions && (
              <ContractVersions
                contractId={id}
                onSelectVersion={(version) => {
                  // Load specific version
                  console.log('Loading version:', version);
                }}
              />
            )}
            
            <ContractEditor
              content={contract.content}
              readOnly={true}
            />
          </div>
        )}

        {activeTab === 'details' && (
          <div className="details-section">
            <div className="detail-group">
              <h3>Contract Information</h3>
              <dl>
                <dt>Contract ID</dt>
                <dd>{contract._id}</dd>
                
                <dt>Type</dt>
                <dd>{contract.type}</dd>
                
                <dt>Value</dt>
                <dd>${contract.value?.toLocaleString() || 'N/A'}</dd>
                
                <dt>Start Date</dt>
                <dd>{contract.startDate ? new Date(contract.startDate).toLocaleDateString() : 'N/A'}</dd>
                
                <dt>End Date</dt>
                <dd>{contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'N/A'}</dd>
              </dl>
            </div>

            <div className="detail-group">
              <h3>Parties</h3>
              <ul className="parties-list">
                {contract.parties?.map((party, index) => (
                  <li key={index} className="party-item">
                    <strong>{party.name}</strong>
                    <span>{party.role}</span>
                    <a href={`mailto:${party.email}`}>{party.email}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="detail-group">
              <h3>Metadata</h3>
              <dl>
                <dt>Created By</dt>
                <dd>{contract.createdBy?.name || 'Unknown'}</dd>
                
                <dt>Last Modified</dt>
                <dd>{new Date(contract.updatedAt).toLocaleString()}</dd>
                
                <dt>Tags</dt>
                <dd>
                  {contract.tags?.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  )) || 'No tags'}
                </dd>
              </dl>
            </div>
          </div>
        )}

        {activeTab === 'approval' && (
          <ApprovalStatus contractId={id} />
        )}

        {activeTab === 'comments' && (
          <CommentThread contractId={id} />
        )}

        {activeTab === 'activity' && (
          <div className="activity-section">
            <h3>Activity Log</h3>
            <ul className="activity-list">
              {contract.activities?.map((activity) => (
                <li key={activity._id} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'created' && '➕'}
                    {activity.type === 'updated' && '✏️'}
                    {activity.type === 'approved' && '✅'}
                    {activity.type === 'signed' && '✍️'}
                  </div>
                  <div className="activity-content">
                    <p>{activity.description}</p>
                    <span className="activity-meta">
                      {activity.user?.name} • {new Date(activity.timestamp).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContractDetail;