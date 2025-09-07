import React from 'react';
import './PresenceIndicator.css';

function PresenceIndicator({ 
  user, 
  status = 'active', 
  size = 'medium',
  showName = true,
  showCursor = false,
  cursorColor 
}) {
  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return '#10B981'; // green
      case 'idle':
        return '#F59E0B'; // yellow
      case 'typing':
        return '#3B82F6'; // blue
      case 'offline':
        return '#6B7280'; // gray
      default:
        return '#6B7280';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserColor = () => {
    if (cursorColor) return cursorColor;
    
    // Generate color from user ID or name
    const str = user._id || user.name || '';
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FECA57', '#FF9FF3', '#54A0FF', '#48DBFB'
    ];
    const hash = str.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={`presence-indicator ${size}`}>
      <div className="avatar-container">
        {user.avatar ? (
          <img 
            src={user.avatar} 
            alt={user.name}
            className="user-avatar"
          />
        ) : (
          <div 
            className="avatar-placeholder"
            style={{ backgroundColor: getUserColor() }}
          >
            {getInitials(user.name)}
          </div>
        )}
        
        <span 
          className={`status-dot ${status}`}
          style={{ backgroundColor: getStatusColor() }}
          title={status}
        />
      </div>

      {showName && (
        <span className="user-name">{user.name}</span>
      )}

      {showCursor && (
        <svg
          className="cursor-indicator"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{ color: getUserColor() }}
        >
          <path
            d="M2 2L2 10L6 8L9 8L2 2Z"
            fill="currentColor"
          />
        </svg>
      )}
    </div>
  );
}

export default PresenceIndicator;