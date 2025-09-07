import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import ContractMetrics from './ContractMetrics';
import UserActivity from './UserActivity';
import Loading from '../common/Loading';
import './Dashboard.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function Dashboard() {
  const { user } = useSelector((state) => state.auth);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/dashboard?range=${dateRange}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load dashboard data');
      
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  if (loading) {
    return <Loading fullscreen />;
  }

  if (!dashboardData) {
    return (
      <div className="error-container">
        <h2>Failed to load dashboard</h2>
        <button onClick={loadDashboardData} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  const {
    summary,
    contractsByStatus,
    contractsByType,
    recentActivity,
    upcomingDeadlines,
    contractTrends,
  } = dashboardData;

  // Chart configurations
  const statusChartData = {
    labels: Object.keys(contractsByStatus),
    datasets: [
      {
        data: Object.values(contractsByStatus),
        backgroundColor: [
          '#10B981', // approved - green
          '#F59E0B', // pending - yellow
          '#6B7280', // draft - gray
          '#EF4444', // rejected - red
          '#3B82F6', // signed - blue
        ],
      },
    ],
  };

  const typeChartData = {
    labels: Object.keys(contractsByType),
    datasets: [
      {
        label: 'Contracts by Type',
        data: Object.values(contractsByType),
        backgroundColor: '#3B82F6',
      },
    ],
  };

  const trendsChartData = {
    labels: contractTrends.map(t => t.date),
    datasets: [
      {
        label: 'Created',
        data: contractTrends.map(t => t.created),
        borderColor: '#10B981',
        backgroundColor: '#10B98120',
        tension: 0.4,
      },
      {
        label: 'Signed',
        data: contractTrends.map(t => t.signed),
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F620',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user.name}!</p>
        </div>
        
        <div className="header-actions">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="date-range-select"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="card-icon">📄</div>
          <div className="card-content">
            <h3>Total Contracts</h3>
            <p className="metric">{summary.totalContracts}</p>
            <span className="change positive">
              +{summary.contractsChange}% from last period
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">✅</div>
          <div className="card-content">
            <h3>Active Contracts</h3>
            <p className="metric">{summary.activeContracts}</p>
            <span className="subtext">
              {summary.expiringThisMonth} expiring this month
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <h3>Total Value</h3>
            <p className="metric">${summary.totalValue.toLocaleString()}</p>
            <span className="change positive">
              +{summary.valueChange}% from last period
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">⏱️</div>
          <div className="card-content">
            <h3>Avg. Approval Time</h3>
            <p className="metric">{summary.avgApprovalTime} days</p>
            <span className="change negative">
              -{summary.approvalTimeChange}% faster
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Contract Status Distribution</h3>
          <div className="chart-container">
            <Doughnut data={statusChartData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-card">
          <h3>Contracts by Type</h3>
          <div className="chart-container">
            <Bar data={typeChartData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-card wide">
          <h3>Contract Trends</h3>
          <div className="chart-container">
            <Line data={trendsChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Activity and Deadlines */}
      <div className="info-row">
        <div className="info-card">
          <h3>Recent Activity</h3>
          <ul className="activity-list">
            {recentActivity.slice(0, 5).map((activity) => (
              <li key={activity._id} className="activity-item">
                <div className="activity-icon">
                  {activity.type === 'created' && '➕'}
                  {activity.type === 'approved' && '✅'}
                  {activity.type === 'signed' && '✍️'}
                  {activity.type === 'rejected' && '❌'}
                </div>
                <div className="activity-content">
                  <p>
                    <strong>{activity.user.name}</strong> {activity.action}{' '}
                    <Link to={`/contracts/${activity.contract._id}`}>
                      {activity.contract.title}
                    </Link>
                  </p>
                  <span className="activity-time">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/activity" className="view-all-link">
            View all activity →
          </Link>
        </div>

        <div className="info-card">
          <h3>Upcoming Deadlines</h3>
          <ul className="deadline-list">
            {upcomingDeadlines.slice(0, 5).map((deadline) => (
              <li key={deadline._id} className="deadline-item">
                <div className="deadline-date">
                  <span className="day">
                    {new Date(deadline.date).getDate()}
                  </span>
                  <span className="month">
                    {new Date(deadline.date).toLocaleDateString('en', { month: 'short' })}
                  </span>
                </div>
                <div className="deadline-content">
                  <Link to={`/contracts/${deadline.contract._id}`}>
                    {deadline.contract.title}
                  </Link>
                  <span className="deadline-type">{deadline.type}</span>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/contracts?filter=expiring" className="view-all-link">
            View all deadlines →
          </Link>
        </div>
      </div>

      {/* Additional Metrics */}
      <ContractMetrics dateRange={dateRange} />
      
      {user.role === 'admin' && (
        <UserActivity dateRange={dateRange} />
      )}
    </div>
  );
}

export default Dashboard;