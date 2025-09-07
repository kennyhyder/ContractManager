import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useWebSocket } from '../../hooks/useWebSocket';
import PresenceIndicator from './PresenceIndicator';
import './CollaborationPanel.css';

function CollaborationPanel({ contractId }) {
  const { user } = useSelector((state) => state.auth);
  const { socket, connected } = useWebSocket();
  
  const [activeUsers, setActiveUsers] = useState([]);
  const [showPanel, setShowPanel] = useState(true);
  const [isTyping, setIsTyping] = useState({});

  useEffect(() => {
    if (connected && contractId) {
      // Join contract room
      socket.emit('join:contract', { contractId });

      // Listen for user updates
      socket.on('users:active', handleActiveUsers);
      socket.on('user:joined', handleUserJoined);
      socket.on('user:left', handleUserLeft);
      socket.on('user:typing', handleUserTyping);

      return () => {
        socket.emit('leave:contract', { contractId });
        socket.off('users:active');
        socket.off('user:joined');
        socket.off('user:left');
        socket.off('user:typing');
      };
    }
  }, [connected, contractId, socket]);

  const handleActiveUsers = (users) => {
    setActiveUsers(users.filter(u => u._id !== user._id));
  };

  const handleUserJoined = (joinedUser) => {
    setActiveUsers(prev => {
      if (prev.find(u => u._id === joinedUser._id)) {
        return prev;
      }
      return [...prev, joinedUser];
    });
  };

  const handleUserLeft = (leftUser) => {
    setActiveUsers(prev => prev.filter(u => u._id !== leftUser._id));
    setIsTyping(prev => {
      const updated = { ...prev };
      delete updated[leftUser._id];
      return updated;
    });
  };

  const handleUserTyping = ({ userId, isTyping: typing }) => {
    setIsTyping(prev => ({
      ...prev,
      [userId]: typing
    }));
  };

  const getUserStatus = (userId) => {
    if (isTyping[userId]) {
      return 'typing';
    }
    return 'active';
  };

  const getUserStatusText = (userId) => {
    if (isTyping[userId]) {
      return 'Typing...';
    }
    return 'Active';
  };

  if (!connected || activeUsers.length === 0) {
    return null;
  }

  return (
    <div className={`collaboration-panel ${showPanel ? 'expanded' : 'collapsed'}`}>
      <div className="panel-header">
        <h3>Active Users ({activeUsers.length + 1})</h3>
        <button
          className="toggle-button"
          onClick={() => setShowPanel(!showPanel)}
          aria-label={showPanel ? 'Collapse panel' : 'Expand panel'}
        >
          {showPanel ? '×' : '👥'}
        </button>
      </div>

      {showPanel && (
        <div className="panel-content">
          <div className="user-list">
            {/* Current user */}
            <div className="user-item current-user">
              <PresenceIndicator
                user={user}
                status="active"
                showCursor={false}
              />
              <div className="user-info">
                <span className="user-name">{user.name} (You)</span>
                <span className="user-status">Editing</span>
              </div>
            </div>

            {/* Other active users */}
            {activeUsers.map((activeUser) => (
              <div key={activeUser._id} className="user-item">
                <PresenceIndicator
                  user={activeUser}
                  status={getUserStatus(activeUser._id)}
                  showCursor={true}
                />
                <div className="user-info">
                  <span className="user-name">{activeUser.name}</span>
                  <span className="user-status">
                    {getUserStatusText(activeUser._id)}
                  </span>
                </div>
                {activeUser.currentSection && (
                  <span className="user-location">
                    in {activeUser.currentSection}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="collaboration-stats">
            <div className="stat">
              <span className="stat-icon">✏️</span>
              <span className="stat-text">
                {Object.values(isTyping).filter(Boolean).length} typing
              </span>
            </div>
            <div className="stat">
              <span className="stat-icon">👁️</span>
              <span className="stat-text">
                {activeUsers.length + 1} viewing
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollaborationPanel;