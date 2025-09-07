import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Bar, Line, Radar } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import './ContractMetrics.css';

function ContractMetrics({ dateRange }) {
  const { user } = useSelector((state) => state.auth);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('performance');

  useEffect(() => {
    loadMetrics();
  }, [dateRange, selectedMetric]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/contracts/metrics?range=${dateRange}&metric=${selectedMetric}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to load metrics');
      
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      toast.error('Failed to load contract metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return <div className="metrics-loading">Loading metrics...</div>;
  }

  const performanceData = {
    labels: metrics.performance.labels,
    datasets: [
      {
        label: 'Completion Rate',
        data: metrics.performance.completionRate,
        borderColor: '#10B981',
        backgroundColor: '#10B98120',
      },
      {
        label: 'On-Time Rate',
        data: metrics.performance.onTimeRate,
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F620',
      },
    ],
  };

  const departmentData = {
    labels: metrics.byDepartment.labels,
    datasets: [
      {
        label: 'Contracts Created',
        data: metrics.byDepartment.created,
        backgroundColor: '#3B82F6',
      },
      {
        label: 'Contracts Completed',
        data: metrics.byDepartment.completed,
        backgroundColor: '#10B981',
      },
    ],
  };

  const complianceData = {
    labels: ['Compliant', 'Non-Compliant', 'Under Review'],
    datasets: [
      {
        data: [
          metrics.compliance.compliant,
          metrics.compliance.nonCompliant,
          metrics.compliance.underReview,
        ],
        backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
      },
    ],
  };

  const riskData = {
    labels: metrics.riskAssessment.categories,
    datasets: [
      {
        label: 'Current Period',
        data: metrics.riskAssessment.current,
        borderColor: '#EF4444',
        backgroundColor: '#EF444420',
      },
      {
        label: 'Previous Period',
        data: metrics.riskAssessment.previous,
        borderColor: '#6B7280',
        backgroundColor: '#6B728020',
      },
    ],
  };

  return (
    <div className="contract-metrics">
      <div className="metrics-header">
        <h2>Contract Analytics</h2>
        <div className="metric-tabs">
          <button
            className={selectedMetric === 'performance' ? 'active' : ''}
            onClick={() => setSelectedMetric('performance')}
          >
            Performance
          </button>
          <button
            className={selectedMetric === 'department' ? 'active' : ''}
            onClick={() => setSelectedMetric('department')}
          >
            By Department
          </button>
          <button
            className={selectedMetric === 'compliance' ? 'active' : ''}
            onClick={() => setSelectedMetric('compliance')}
          >
            Compliance
          </button>
          <button
            className={selectedMetric === 'risk' ? 'active' : ''}
            onClick={() => setSelectedMetric('risk')}
          >
            Risk Assessment
          </button>
        </div>
      </div>

      <div className="metrics-content">
        {selectedMetric === 'performance' && (
          <div className="metric-section">
            <div className="metric-summary">
              <div className="summary-item">
                <h4>Average Processing Time</h4>
                <p className="metric-value">{metrics.performance.avgProcessingTime} days</p>
                <span className="metric-change positive">
                  ↓ {metrics.performance.processingTimeChange}% faster
                </span>
              </div>
              <div className="summary-item">
                <h4>Approval Rate</h4>
                <p className="metric-value">{metrics.performance.approvalRate}%</p>
                <span className="metric-change positive">
                  ↑ {metrics.performance.approvalRateChange}%
                </span>
              </div>
              <div className="summary-item">
                <h4>Error Rate</h4>
                <p className="metric-value">{metrics.performance.errorRate}%</p>
                <span className="metric-change negative">
                  ↓ {metrics.performance.errorRateChange}%
                </span>
              </div>
            </div>
            <div className="chart-container">
              <Line data={performanceData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>
        )}

        {selectedMetric === 'department' && (
          <div className="metric-section">
            <div className="chart-container">
              <Bar data={departmentData} options={{ maintainAspectRatio: false }} />
            </div>
            <div className="department-table">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Total Contracts</th>
                    <th>Active</th>
                    <th>Avg. Value</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byDepartment.details.map((dept) => (
                    <tr key={dept.name}>
                      <td>{dept.name}</td>
                      <td>{dept.total}</td>
                      <td>{dept.active}</td>
                      <td>${dept.avgValue.toLocaleString()}</td>
                      <td>
                        <span className={`efficiency ${dept.efficiency > 80 ? 'high' : 'low'}`}>
                          {dept.efficiency}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedMetric === 'compliance' && (
          <div className="metric-section">
            <div className="compliance-overview">
              <div className="compliance-score">
                <h3>Overall Compliance Score</h3>
                <div className="score-circle">
                  <span className="score-value">{metrics.compliance.score}%</span>
                </div>
              </div>
              <div className="chart-container small">
                <Doughnut data={complianceData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="compliance-details">
              <h4>Compliance Issues</h4>
              <ul className="issues-list">
                {metrics.compliance.issues.map((issue, index) => (
                  <li key={index} className="issue-item">
                    <span className="issue-type">{issue.type}</span>
                    <span className="issue-count">{issue.count} contracts</span>
                    <span className={`issue-severity ${issue.severity}`}>
                      {issue.severity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {selectedMetric === 'risk' && (
          <div className="metric-section">
            <div className="risk-overview">
              <div className="risk-summary">
                <div className="risk-item high">
                  <h4>High Risk</h4>
                  <p>{metrics.riskAssessment.high} contracts</p>
                </div>
                <div className="risk-item medium">
                  <h4>Medium Risk</h4>
                  <p>{metrics.riskAssessment.medium} contracts</p>
                </div>
                <div className="risk-item low">
                  <h4>Low Risk</h4>
                  <p>{metrics.riskAssessment.low} contracts</p>
                </div>
              </div>
              <div className="chart-container">
                <Radar data={riskData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="risk-factors">
              <h4>Top Risk Factors</h4>
              <ul className="factors-list">
                {metrics.riskAssessment.topFactors.map((factor, index) => (
                  <li key={index} className="factor-item">
                    <span className="factor-name">{factor.name}</span>
                    <div className="factor-bar">
                      <div 
                        className="factor-fill"
                        style={{ width: `${factor.impact}%` }}
                      />
                    </div>
                    <span className="factor-impact">{factor.impact}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="export-section">
        <button onClick={() => exportMetrics('pdf')} className="btn btn-secondary">
          Export as PDF
        </button>
        <button onClick={() => exportMetrics('excel')} className="btn btn-secondary">
          Export as Excel
        </button>
      </div>
    </div>
  );

  async function exportMetrics(format) {
    try {
      const response = await fetch(
        `/api/analytics/export?format=${format}&metric=${selectedMetric}&range=${dateRange}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract-metrics-${selectedMetric}-${dateRange}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Metrics exported successfully');
    } catch (error) {
      toast.error('Failed to export metrics');
    }
  }
}

export default ContractMetrics;