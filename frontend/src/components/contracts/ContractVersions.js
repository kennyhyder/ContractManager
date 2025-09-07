import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import './ContractVersions.css';

function ContractVersions({ contractId, onSelectVersion }) {
  const { user } = useSelector((state) => state.auth);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState([]);

  useEffect(() => {
    loadVersions();
  }, [contractId]);

  const loadVersions = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/versions`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load versions');
      
      const data = await response.json();
      setVersions(data.versions);
    } catch (error) {
      console.error('Failed to load versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId) => {
    if (!window.confirm('Are you sure you want to restore this version?')) {
      return;
    }

    try {
      const response = await fetch(`/api/contracts/${contractId}/versions/${versionId}/restore`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to restore version');

      toast.success('Version restored successfully');
      onSelectVersion && onSelectVersion(versionId);
    } catch (error) {
      toast.error('Failed to restore version');
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length !== 2) {
      toast.error('Please select exactly 2 versions to compare');
      return;
    }

    const [v1, v2] = selectedVersions;
    window.open(`/contracts/compare?left=${v1}&right=${v2}`, '_blank');
  };

  const toggleVersionSelection = (versionId) => {
    setSelectedVersions((prev) =>
      prev.includes(versionId)
        ? prev.filter((id) => id !== versionId)
        : [...prev, versionId].slice(-2)
    );
  };

  if (loading) {
    return <div className="versions-loading">Loading version history...</div>;
  }

  return (
    <div className="contract-versions">
      <div className="versions-header">
        <h3>Version History</h3>
        {selectedVersions.length === 2 && (
          <button onClick={handleCompare} className="btn btn-primary btn-sm">
            Compare Selected
          </button>
        )}
      </div>

      <div className="versions-list">
        {versions.map((version) => (
          <div key={version._id} className="version-item">
            <input
              type="checkbox"
              checked={selectedVersions.includes(version._id)}
              onChange={() => toggleVersionSelection(version._id)}
              className="version-checkbox"
            />
            
            <div className="version-info">
              <div className="version-header">
                <span className="version-number">v{version.version}</span>
                {version.isCurrent && (
                  <span className="current-badge">Current</span>
                )}
              </div>
              
              <div className="version-meta">
                <span className="version-author">{version.author?.name}</span>
                <span className="version-date">
                  {new Date(version.createdAt).toLocaleString()}
                </span>
              </div>
              
              {version.comment && (
                <p className="version-comment">{version.comment}</p>
              )}
              
              <div className="version-changes">
                {version.changes?.map((change, index) => (
                  <span key={index} className={`change-tag change-${change.type}`}>
                    {change.type}: {change.field}
                  </span>
                ))}
              </div>
            </div>

            <div className="version-actions">
              <button
                onClick={() => onSelectVersion(version)}
                className="btn btn-link"
                title="View this version"
              >
                View
              </button>
              
              {!version.isCurrent && (
                <button
                  onClick={() => handleRestore(version._id)}
                  className="btn btn-link"
                  title="Restore this version"
                >
                  Restore
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {versions.length === 0 && (
        <div className="empty-versions">
          <p>No version history available</p>
        </div>
      )}
    </div>
  );
}

export default ContractVersions;