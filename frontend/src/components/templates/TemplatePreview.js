import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import Loading from '../common/Loading';
import './TemplatePreview.css';

function TemplatePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [variableValues, setVariableValues] = useState({});
  const [showVariablePanel, setShowVariablePanel] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    try {
      const response = await fetch(`/api/templates/${id}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load template');
      
      const data = await response.json();
      setTemplate(data.template);
      
      // Initialize variable values with defaults
      const initialValues = {};
      data.template.variables?.forEach(variable => {
        initialValues[variable.name] = variable.defaultValue || '';
      });
      setVariableValues(initialValues);
    } catch (error) {
      console.error('Failed to load template:', error);
      toast.error('Failed to load template');
      navigate('/templates');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (!template) return '';
    
    let content = template.content;
    
    // Replace variables with their values
    Object.entries(variableValues).forEach(([name, value]) => {
      const regex = new RegExp(`{{${name}}}`, 'g');
      content = content.replace(regex, value || `[${name}]`);
    });
    
    // Highlight any remaining variables
    content = content.replace(/{{(\w+)}}/g, '<span class="missing-variable">[Missing: $1]</span>');
    
    return content;
  };

  const handleUseTemplate = () => {
    navigate(`/contracts/new?template=${id}`);
  };

  const handleExportPreview = () => {
    const element = document.createElement('a');
    const file = new Blob([renderContent()], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `${template.name}-preview.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return <Loading fullscreen />;
  }

  if (!template) {
    return (
      <div className="error-container">
        <h2>Template not found</h2>
        <button onClick={() => navigate('/templates')} className="btn btn-primary">
          Back to Templates
        </button>
      </div>
    );
  }

  return (
    <div className="template-preview-container">
      <div className="preview-header">
        <div className="header-left">
          <button onClick={() => navigate('/templates')} className="back-button">
            ← Back to Templates
          </button>
          <h1>{template.name}</h1>
          <span className="template-category">{template.category}</span>
        </div>
        
        <div className="header-actions">
          <button
            onClick={() => setShowVariablePanel(!showVariablePanel)}
            className="btn btn-secondary"
          >
            {showVariablePanel ? 'Hide' : 'Show'} Variables
          </button>
          <button onClick={handleExportPreview} className="btn btn-secondary">
            Export Preview
          </button>
          <button onClick={handleUseTemplate} className="btn btn-primary">
            Use This Template
          </button>
        </div>
      </div>

      <div className="preview-body">
        {showVariablePanel && template.variables?.length > 0 && (
          <div className="variables-panel">
            <h3>Template Variables</h3>
            <p className="help-text">
              Fill in the variables to see how your contract will look
            </p>
            
            {template.variables.map((variable) => (
              <div key={variable.name} className="variable-input">
                <label>
                  {variable.name}
                  {variable.required && <span className="required">*</span>}
                </label>
                
                {variable.type === 'select' && variable.options ? (
                  <select
                    value={variableValues[variable.name] || ''}
                    onChange={(e) => setVariableValues({
                      ...variableValues,
                      [variable.name]: e.target.value
                    })}
                    className="form-control"
                  >
                    <option value="">Select {variable.name}</option>
                    {variable.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : variable.type === 'boolean' ? (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={variableValues[variable.name] === 'true'}
                      onChange={(e) => setVariableValues({
                        ...variableValues,
                        [variable.name]: e.target.checked ? 'true' : 'false'
                      })}
                    />
                    <span>{variable.label || variable.name}</span>
                  </label>
                ) : (
                  <input
                    type={variable.type || 'text'}
                    value={variableValues[variable.name] || ''}
                    onChange={(e) => setVariableValues({
                      ...variableValues,
                      [variable.name]: e.target.value
                    })}
                    placeholder={variable.placeholder || `Enter ${variable.name}`}
                    className="form-control"
                  />
                )}
                
                {variable.description && (
                  <small className="variable-description">{variable.description}</small>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={`preview-content ${showVariablePanel ? 'with-panel' : ''}`}>
          <div className="template-info">
            <p className="template-description">{template.description}</p>
            {template.tags?.length > 0 && (
              <div className="template-tags">
                {template.tags.map((tag) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            )}
          </div>

          <div className="content-preview">
            <div 
              className="contract-content"
              dangerouslySetInnerHTML={{ __html: renderContent() }}
            />
          </div>

          <div className="template-metadata">
            <dl>
              <dt>Created By</dt>
              <dd>{template.createdBy?.name || 'Unknown'}</dd>
              
              <dt>Last Updated</dt>
              <dd>{new Date(template.updatedAt).toLocaleDateString()}</dd>
              
              <dt>Used</dt>
              <dd>{template.usageCount || 0} times</dd>
              
              {template.rating && (
                <>
                  <dt>Rating</dt>
                  <dd>
                    {'⭐'.repeat(Math.round(template.rating))} ({template.rating}/5)
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplatePreview;