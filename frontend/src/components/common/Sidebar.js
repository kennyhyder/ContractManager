import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import './Sidebar.css';

function Sidebar() {
  const { user } = useSelector((state) => state.auth);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigation = [
    {
      title: 'Main',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/contracts', label: 'Contracts', icon: '📄' },
        { path: '/templates', label: 'Templates', icon: '📋' },
        { path: '/marketplace', label: 'Marketplace', icon: '🛒' },
      ],
    },
    {
      title: 'Management',
      items: [
        { 
          path: '/approvals', 
          label: 'Approvals', 
          icon: '✅',
          requiredRole: 'approver'
        },
        { 
          path: '/users', 
          label: 'Users', 
          icon: '👥',
          requiredRole: 'admin'
        },
        { 
          path: '/settings', 
          label: 'Settings', 
          icon: '⚙️',
          requiredRole: 'admin'
        },
      ],
    },
  ];

  const hasAccess = (item) => {
    if (!item.requiredRole) return true;
    return user?.role === item.requiredRole || user?.role === 'admin';
  };

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="collapse-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '→' : '←'}
      </button>

      <nav className="sidebar-nav">
        {navigation.map((section) => (
          <div key={section.title} className="nav-section">
            {!isCollapsed && (
              <h3 className="nav-section-title">{section.title}</h3>
            )}
            <ul className="nav-list">
              {section.items
                .filter(hasAccess)
                .map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? 'active' : ''}`
                      }
                      title={item.label}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {!isCollapsed && (
                        <span className="nav-label">{item.label}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="storage-info">
            <div className="storage-bar">
              <div className="storage-used" style={{ width: '65%' }}></div>
            </div>
            <p className="storage-text">6.5 GB of 10 GB used</p>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;