import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import DiffMatchPatch from 'diff-match-patch';
import Loading from '../common/Loading';
import './ContractComparison.css';

function ContractComparison() {
  const [searchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);
  
  const [contracts, setContracts] = useState({ left: null, right: null });
  const [loading, setLoading] = useState(true);
  const [diffMode, setDiffMode] = useState('side-by-side'); // or 'inline'
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);

  const leftId = searchParams.get('left');
  const rightId = searchParams.get('right');

  useEffect(() => {
    if (leftId && rightId) {
      loadContracts();
    }
  }, [leftId, rightId]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const [leftResponse, rightResponse] = await Promise.all([
        fetch(`/api/contracts/${leftId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        fetch(`/api/contracts/${rightId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        }),
      ]);

      const leftContract = await leftResponse.json();
      const rightContract = await rightResponse.json();

      setContracts({ left: leftContract, right: rightContract });
    } catch (error) {
      console.error('Failed to load contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const computeDiff = () => {
    if (!contracts.left || !contracts.right) return null;

    const dmp = new DiffMatchPatch();
    const diff = dmp.diff_main(
      contracts.left.content || '',
      contracts.right.content || ''
    );
    dmp.diff_cleanupSemantic(diff);

    return diff;
  };

  const renderDiff = () => {
    const diff = computeDiff();
    if (!diff) return null;

    return diff.map((part, index) => {
      const [type, text] = part;
      
      if (type === 0) {
        // No change
        return showOnlyDifferences ? null : (
          <span key={index} className="diff-equal">
            {text}
          </span>
        );
      } else if (type === -1) {
        // Deletion
        return (
          <span key={index} className="diff-deletion">
            {text}
          </span>
        );
      } else {
        // Addition
        return (
          <span key={index} className="diff-addition">
            {text}
          </span>
        );
      }
    });
  };

  if (loading) {
    return <Loading fullscreen />;
  }

  if (!contracts.left || !contracts.right) {
    return (
      <div className="error-container">
        <h2>Unable to load contracts for comparison</h2>
      </div>
    );
  }

  return (
    <div className="contract-comparison-container">
      <div className="comparison-header">
        <h1>Contract Comparison</h1>
        
        <div className="comparison-controls">
          <label>
            <input
              type="checkbox"
              checked={showOnlyDifferences}
              onChange={(e) => setShowOnlyDifferences(e.target.checked)}
            />
            Show only differences
          </label>
          
          <div className="view-mode-toggle">
            <button
              className={`toggle-button ${diffMode === 'side-by-side' ? 'active' : ''}`}
              onClick={() => setDiffMode('side-by-side')}
            >
              Side by Side
            </button>
            <button
              className={`toggle-button ${diffMode === 'inline' ? 'active' : ''}`}
              onClick={() => setDiffMode('inline')}
            >
              Inline
            </button>
          </div>
        </div>
      </div>

      <div className="comparison-info">
        <div className="contract-info left">
          <h3>{contracts.left.title}</h3>
          <span>Version {contracts.left.version || '1.0'}</span>
          <span>{new Date(contracts.left.updatedAt).toLocaleString()}</span>
        </div>
        
        <div className="vs-divider">VS</div>
        
        <div className="contract-info right">
          <h3>{contracts.right.title}</h3>
          <span>Version {contracts.right.version || '1.0'}</span>
          <span>{new Date(contracts.right.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="comparison-content">
        {diffMode === 'side-by-side' ? (
          <div className="side-by-side-view">
            <div className="comparison-pane left-pane">
              <h4>Original</h4>
              <div
                className="contract-content"
                dangerouslySetInnerHTML={{ __html: contracts.left.content }}
              />
            </div>
            
            <div className="comparison-pane right-pane">
              <h4>Modified</h4>
              <div
                className="contract-content"
                dangerouslySetInnerHTML={{ __html: contracts.right.content }}
              />
            </div>
          </div>
        ) : (
          <div className="inline-diff-view">
            <div className="diff-content">
              {renderDiff()}
            </div>
          </div>
        )}
      </div>

      <div className="comparison-stats">
        <h3>Summary</h3>
        <div className="stats-grid">
          <div className="stat">
            <span className="stat-label">Additions</span>
            <span className="stat-value addition">+{computeDiff()?.filter(d => d[0] === 1).length || 0}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Deletions</span>
            <span className="stat-value deletion">-{computeDiff()?.filter(d => d[0] === -1).length || 0}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Unchanged</span>
            <span className="stat-value">{computeDiff()?.filter(d => d[0] === 0).length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContractComparison;