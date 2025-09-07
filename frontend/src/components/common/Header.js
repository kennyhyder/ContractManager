import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../../store/authSlice';
import { clearNotifications } from '../../store/notificationSlice';
import './Header.css';

function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { unreadCount } = useSelector((state) => state.notifications);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) {
      dispatch(clearNotifications());
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/" className="logo">
          <span className="logo-icon">📄</span>
          <span className="logo-text">Contract Management</span>
        </Link>
      </div>

      <div className="header-center">
        <div className="search-bar">
          <input
            type="search"
            placeholder="Search contracts..."
            className="search-input"
          />
        </div>
      </div>

      <div className="header-right">
        <button
          className="header-button notification-button"
          onClick={handleNotificationClick}
          aria-label="Notifications"
        >
          <span className="icon">🔔</span>
          {unreadCount > 0 && (
            <span className="badge">{unreadCount}</span>
          )}
        </button>

        <div className="user-menu-container">
          <button
            className="user-menu-button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User menu"
          >
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="user-name">{user?.name || 'User'}</span>
          </button>

          {showUserMenu && (
            <div className="user-menu-dropdown">
              <Link
                to="/profile"
                className="dropdown-item"
                onClick={() => setShowUserMenu(false)}
              >
                Profile
              </Link>
              <Link
                to="/settings"
                className="dropdown-item"
                onClick={() => setShowUserMenu(false)}
              >
                Settings
              </Link>
              <hr className="dropdown-divider" />
              <button
                className="dropdown-item"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {showNotifications && (
        <div className="notifications-dropdown">
          <div className="dropdown-header">
            <h3>Notifications</h3>
            <button className="clear-all">Clear all</button>
          </div>
          <div className="notifications-list">
            <p className="empty-state">No new notifications</p>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;