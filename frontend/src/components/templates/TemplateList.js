import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import Loading from '../common/Loading';
import './TemplateList.css';

function TemplateList() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    sortBy: 'name',
  });
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [filters]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`/api/templates?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load templates');
      
      const data = await response.json();
      setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromTemplate = (templateId) => {
    navigate(`/contracts/new?template=${templateId}`);
  };

  const handleEditTemplate = (templateId) => {
    navigate(`/templates/${templateId}/edit`);
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete template');

      toast.success('Template deleted successfully');
      loadTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleDuplicateTemplate = async (templateId) => {
    try {
      const response = await fetch(`/api/templates/${templateId}/duplicate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to duplicate template');

      const data = await response.json();
      toast.success('Template duplicated successfully');
      navigate(`/templates/${data.template._id}/edit`);
    } catch (error) {
      toast.error('Failed to duplicate template');
    }
  };

  const handleExportTemplates = async () => {
    try {
      const response = await fetch('/api/templates/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ templateIds: selectedTemplates }),
      });

      if (!response.ok) throw new Error('Failed to export templates');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'templates-export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Templates exported successfully');
    } catch (error) {
      toast.error('Failed to export templates');
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const categories = [
    'Non-Disclosure Agreement',
    'Service Agreement',
    'Purchase Agreement',
    'Employment Contract',
    'Lease Agreement',
    'Partnership Agreement',
    'Other',
  ];

  if (loading && templates.length === 0) {
    return <Loading fullscreen />;
  }

  return (
    <div className="template-list-container">
      <div className="page-header">
        <h1>Contract Templates</h1>
        <div className="header-actions">
          {selectedTemplates.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={handleExportTemplates}
            >
              Export ({selectedTemplates.length})
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span>➕</span> Create Template
          </button>
        </div>
      </div>

      <div className="filters-section">
        <input
          type="search"
          placeholder="Search templates..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="search-input"
        />

        <select
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          className="filter-select"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={filters.sortBy}
          onChange={(e) => handleFilterChange('sortBy', e.target.value)}
          className="filter-select"
        >
          <option value="name">Sort by Name</option>
          <option value="category">Sort by Category</option>
          <option value="usage">Sort by Usage</option>
          <option value="updated">Sort by Last Updated</option>
        </select>
      </div>

      <div className="templates-grid">
        {templates.map((template) => (
          <div key={template._id} className="template-card">
            <div className="template-header">
              <input
                type="checkbox"
                checked={selectedTemplates.includes(template._id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTemplates([...selectedTemplates, template._id]);
                  } else {
                    setSelectedTemplates(selectedTemplates.filter(id => id !== template._id));
                  }
                }}
                className="template-checkbox"
              />
              <div className="template-icon">
                {template.category === 'Non-Disclosure Agreement' && '🤐'}
                {template.category === 'Service Agreement' && '🤝'}
                {template.category === 'Purchase Agreement' && '🛒'}
                {template.category === 'Employment Contract' && '💼'}
                {template.category === 'Lease Agreement' && '🏠'}
                {template.category === 'Partnership Agreement' && '👥'}
                {!['Non-Disclosure Agreement', 'Service Agreement', 'Purchase Agreement', 'Employment Contract', 'Lease Agreement', 'Partnership Agreement'].includes(template.category) && '📄'}
              </div>
            </div>

            <div className="template-body">
              <h3>{template.name}</h3>
              <p className="template-description">{template.description}</p>
              
              <div className="template-meta">
                <span className="category-tag">{template.category}</span>
                <span className="usage-count">Used {template.usageCount || 0} times</span>
              </div>

              {template.tags && template.tags.length > 0 && (
                <div className="template-tags">
                  {template.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="template-footer">
              <button
                onClick={() => handleCreateFromTemplate(template._id)}
                className="btn btn-primary btn-sm"
              >
                Use Template
              </button>
              
              <div className="template-actions">
                <button
                  onClick={() => navigate(`/templates/${template._id}/preview`)}
                  className="action-btn"
                  title="Preview"
                >
                  👁️
                </button>
                
                {(user?.role === 'admin' || template.createdBy === user?._id) && (
                  <>
                    <button
                      onClick={() => handleEditTemplate(template._id)}
                      className="action-btn"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDuplicateTemplate(template._id)}
                      className="action-btn"
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template._id)}
                      className="action-btn danger"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && !loading && (
        <div className="empty-state">
          <p>No templates found</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create your first template
          </button>
        </div>
      )}

      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(templateId) => {
            setShowCreateModal(false);
            navigate(`/templates/${templateId}/edit`);
          }}
        />
      )}
    </div>
  );
}

function CreateTemplateModal({ onClose, onSuccess }) {
  const { user } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create template');

      const data = await response.json();
      toast.success('Template created successfully');
      onSuccess(data.template._id);
    } catch (error) {
      toast.error('Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Template</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Template Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
              className="form-control"
            >
              <option value="">Select category</option>
              <option value="Non-Disclosure Agreement">Non-Disclosure Agreement</option>
              <option value="Service Agreement">Service Agreement</option>
              <option value="Purchase Agreement">Purchase Agreement</option>
              <option value="Employment Contract">Employment Contract</option>
              <option value="Lease Agreement">Lease Agreement</option>
              <option value="Partnership Agreement">Partnership Agreement</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="form-control"
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TemplateList;