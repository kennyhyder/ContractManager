import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import { toast } from 'react-toastify';
import './ReportGenerator.css';

function ReportGenerator() {
  const { user } = useSelector((state) => state.auth);
  const [reportConfig, setReportConfig] = useState({
    type: 'summary',
    dateRange: 'custom',
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date(),
    metrics: [],
    filters: {},
    format: 'pdf',
    schedule: 'once',
  });
  const [generating, setGenerating] = useState(false);
  const [savedReports, setSavedReports] = useState([]);

  const reportTypes = [
    { value: 'summary', label: 'Executive Summary' },
    { value: 'detailed', label: 'Detailed Analytics' },
    { value: 'compliance', label: 'Compliance Report' },
    { value: 'performance', label: 'Performance Report' },
    { value: 'user', label: 'User Activity Report' },
    { value: 'custom', label: 'Custom Report' },
  ];

  const availableMetrics = [
    { value: 'contracts_created', label: 'Contracts Created' },
    { value: 'contracts_signed', label: 'Contracts Signed' },
    { value: 'approval_time', label: 'Approval Time' },
    { value: 'compliance_rate', label: 'Compliance Rate' },
    { value: 'user_activity', label: 'User Activity' },
    { value: 'contract_value', label: 'Contract Value' },
    { value: 'risk_assessment', label: 'Risk Assessment' },
    { value: 'department_breakdown', label: 'Department Breakdown' },
  ];

  const scheduleOptions = [
    { value: 'once', label: 'Generate Once' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/analytics/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(reportConfig),
      });

      if (!response.ok) throw new Error('Failed to generate report');

      if (reportConfig.schedule === 'once') {
        // Download immediately
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${reportConfig.type}-${Date.now()}.${reportConfig.format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Report generated successfully');
      } else {
        // Scheduled report
        const data = await response.json();
        toast.success(`Report scheduled successfully. ID: ${data.reportId}`);
      }
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const loadSavedReports = async () => {
    try {
      const response = await fetch('/api/analytics/reports/saved', {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load saved reports');
      
      const data = await response.json();
      setSavedReports(data.reports);
    } catch (error) {
      console.error('Failed to load saved reports:', error);
    }
  };

  return (
    <div className="report-generator">
      <div className="generator-header">
        <h2>Report Generator</h2>
        <button
          onClick={loadSavedReports}
          className="btn btn-secondary"
        >
          View Saved Reports
        </button>
      </div>

      <div className="report-form">
        <div className="form-section">
          <h3>Report Configuration</h3>
          
          <div className="form-group">
            <label>Report Type</label>
            <Select
              value={reportTypes.find(t => t.value === reportConfig.type)}
              onChange={(option) => setReportConfig({ ...reportConfig, type: option.value })}
              options={reportTypes}
              className="report-select"
            />
          </div>

          <div className="form-group">
            <label>Date Range</label>
            <div className="date-range-picker">
              <DatePicker
                selected={reportConfig.startDate}
                onChange={(date) => setReportConfig({ ...reportConfig, startDate: date })}
                selectsStart
                startDate={reportConfig.startDate}
                endDate={reportConfig.endDate}
                className="date-input"
              />
              <span>to</span>
              <DatePicker
                selected={reportConfig.endDate}
                onChange={(date) => setReportConfig({ ...reportConfig, endDate: date })}
                selectsEnd
                startDate={reportConfig.startDate}
                endDate={reportConfig.endDate}
                minDate={reportConfig.startDate}
                className="date-input"
              />
            </div>
          </div>

          {reportConfig.type === 'custom' && (
            <div className="form-group">
              <label>Select Metrics</label>
              <Select
                isMulti
                value={availableMetrics.filter(m => reportConfig.metrics.includes(m.value))}
                onChange={(options) => setReportConfig({
                  ...reportConfig,
                  metrics: options ? options.map(o => o.value) : []
                })}
                options={availableMetrics}
                className="metrics-select"
              />
            </div>
          )}

          <div className="form-group">
            <label>Output Format</label>
            <div className="format-options">
              <label>
                <input
                  type="radio"
                  value="pdf"
                  checked={reportConfig.format === 'pdf'}
                  onChange={(e) => setReportConfig({ ...reportConfig, format: e.target.value })}
                />
                PDF
              </label>
              <label>
                <input
                  type="radio"
                  value="excel"
                  checked={reportConfig.format === 'excel'}
                  onChange={(e) => setReportConfig({ ...reportConfig, format: e.target.value })}
                />
                Excel
              </label>
              <label>
                <input
                  type="radio"
                  value="csv"
                  checked={reportConfig.format === 'csv'}
                  onChange={(e) => setReportConfig({ ...reportConfig, format: e.target.value })}
                />
                CSV
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Schedule</label>
            <Select
              value={scheduleOptions.find(s => s.value === reportConfig.schedule)}
              onChange={(option) => setReportConfig({ ...reportConfig, schedule: option.value })}
              options={scheduleOptions}
              className="schedule-select"
            />
          </div>

          {reportConfig.schedule !== 'once' && (
            <div className="form-group">
              <label>Email Recipients</label>
              <input
                type="text"
                placeholder="Enter email addresses separated by commas"
                onChange={(e) => setReportConfig({
                  ...reportConfig,
                  recipients: e.target.value.split(',').map(email => email.trim())
                })}
                className="form-control"
              />
            </div>
          )}
        </div>

        <div className="form-actions">
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="btn btn-primary"
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {savedReports.length > 0 && (
        <div className="saved-reports">
          <h3>Saved Reports</h3>
          <div className="reports-list">
            {savedReports.map((report) => (
              <div key={report._id} className="report-item">
                <div className="report-info">
                  <h4>{report.name}</h4>
                  <p>{report.type} • {report.schedule}</p>
                  <span className="report-date">
                    Created {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="report-actions">
                  <button
                    onClick={() => downloadReport(report._id)}
                    className="btn btn-sm btn-secondary"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => deleteReport(report._id)}
                    className="btn btn-sm btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  async function downloadReport(reportId) {
    try {
      const response = await fetch(`/api/analytics/reports/${reportId}/download`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to download report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Failed to download report');
    }
  }

  async function deleteReport(reportId) {
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      const response = await fetch(`/api/analytics/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete report');

      toast.success('Report deleted successfully');
      loadSavedReports();
    } catch (error) {
      toast.error('Failed to delete report');
    }
  }
}

export default ReportGenerator;