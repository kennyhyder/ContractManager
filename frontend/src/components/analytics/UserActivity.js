import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Line, Bar } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import './UserActivity.css';

function UserActivity({ dateRange }) {
  const { user } = useSelector((state) => state.auth);
  const [activityData, setActivityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('all');
  const [activityType, setActivityType] = useState('all');

  useEffect(() => {
    loadActivityData();
  }, [dateRange, selectedUser, activityType]);

  const loadActivityData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        range: dateRange,
        user: selectedUser,
        type: activityType,
      });
      
      const response = await fetch(`/api/analytics/user-activity?${params}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load activity data');
      
      const data = await response.json();
      setActivityData(data);
    } catch (error) {
      console.error('Failed to load activity data:', error);
      toast.error('Failed to load user activity');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !activityData) {
    return <div className="activity-loading">Loading user activity...</div>;
  }

  const activityChartData = {
    labels: activityData.timeline.labels,
    datasets: [
      {
        label: 'Logins',
        data: activityData.timeline.logins,
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F620',
      },
      {
        label: 'Actions',
        data: activityData.timeline.actions,
        borderColor: '#10B981',
        backgroundColor: '#10B98120',
      },
    ],
  };

  const userComparisonData = {
    labels: activityData.topUsers.map(u => u.name),
    datasets: [
      {
        label: 'Total Actions',
        data: activityData.topUsers.map(u => u.actions),
        backgroundColor: '#3B82F6',
      },
    ],
  };

  const activityBreakdownData = {
    labels: Object.keys(activityData.breakdown),
    datasets: [
      {
        data: Object.values(activityData.breakdown),
        backgroundColor: [
          '#3B82F6',
          '#10B981',
          '#F59E0B',
          '#EF4444',
          '#8B5CF6',
          '#EC4899',
        ],
      },
    ],
  };

  return (
    <div className="user-activity">
      <div className="activity-header">
        <h2>User Activity</h2>
        <div className="activity-filters">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Users</option>
            {activityData.users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
          
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Activities</option>
            <option value="login">Logins</option>
            <option value="create">Creates</option>
            <option value="update">Updates</option>
            <option value="approve">Approvals</option>
            <option value="sign">Signatures</option>
          </select>
        </div>
      </div>

      <div className="activity-stats">
        <div className="stat-card">
          <h4>Active Users</h4>
          <p className="stat-value">{activityData.stats.activeUsers}</p>
          <span className="stat-subtext">
            {activityData.stats.percentActive}% of total
          </span>
        </div>
        
        <div className="stat-card">
          <h4>Total Actions</h4>
          <p className="stat-value">{activityData.stats.totalActions}</p>
          <span className="stat-subtext">
            {activityData.stats.actionsPerUser} per user
          </span>
        </div>
        
        <div className="stat-card">
          <h4>Peak Hours</h4>
          <p className="stat-value">{activityData.stats.peakHours}</p>
          <span className="stat-subtext">Most active time</span>
        </div>
        
        <div className="stat-card">
          <h4>Avg. Session</h4>
          <p className="stat-value">{activityData.stats.avgSessionDuration}</p>
          <span className="stat-subtext">Duration per session</span>
        </div>
      </div>

      <div className="activity-charts">
        <div className="chart-card">
          <h3>Activity Timeline</h3>
          <div className="chart-container">
            <Line 
              data={activityChartData} 
              options={{ 
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }} 
            />
          </div>
        </div>

        <div className="chart-card">
          <h3>Top Active Users</h3>
          <div className="chart-container">
            <Bar 
              data={userComparisonData} 
              options={{ 
                maintainAspectRatio: false,
                indexAxis: 'y',
              }} 
            />
          </div>
        </div>

        <div className="chart-card">
          <h3>Activity Breakdown</h3>
          <div className="chart-container">
            <Doughnut 
              data={activityBreakdownData} 
              options={{ maintainAspectRatio: false }} 
            />
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent User Activity</h3>
        <div className="activity-table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Target</th>
                <th>Time</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {activityData.recentActivity.map((activity) => (
                <tr key={activity._id}>
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">
                        {activity.user.name.charAt(0)}
                      </div>
                      <span>{activity.user.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`action-type ${activity.type}`}>
                      {activity.type}
                    </span>
                  </td>
                  <td>{activity.target || '-'}</td>
                  <td>{new Date(activity.timestamp).toLocaleString()}</td>
                  <td>{activity.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="activity-insights">
        <h3>Insights & Recommendations</h3>
        <ul className="insights-list">
          {activityData.insights.map((insight, index) => (
            <li key={index} className={`insight-item ${insight.type}`}>
              <span className="insight-icon">
                {insight.type === 'warning' && '⚠️'}
                {insight.type === 'success' && '✅'}
                {insight.type === 'info' && 'ℹ️'}
              </span>
              <div className="insight-content">
                <p>{insight.message}</p>
                {insight.recommendation && (
                  <span className="recommendation">{insight.recommendation}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default UserActivity;