import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Formik, Form, Field, FieldArray } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Select from 'react-select';
import ContractEditor from '../contracts/ContractEditor';
import Loading from '../common/Loading';
import './TemplateForm.css';

const templateSchema = Yup.object().shape({
  name: Yup.string().required('Template name is required'),
  category: Yup.string().required('Category is required'),
  description: Yup.string(),
  content: Yup.string().required('Template content is required'),
  variables: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required('Variable name is required'),
      type: Yup.string().required('Variable type is required'),
      defaultValue: Yup.string(),
      required: Yup.boolean(),
    })
  ),
  tags: Yup.array().of(Yup.string()),
  isPublic: Yup.boolean(),
});

const variableTypes = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes/No' },
];

function TemplateForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState({});

  const isEdit = Boolean(id);

  useEffect(() => {
    if (isEdit && id) {
      loadTemplate();
    }
  }, [id, isEdit]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/templates/${id}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load template');
      
      const data = await response.json();
      setTemplate(data.template);
    } catch (error) {
      console.error('Failed to load template:', error);
      toast.error('Failed to load template');
      navigate('/templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const url = isEdit ? `/api/templates/${id}` : '/api/templates';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) throw new Error('Failed to save template');

      const data = await response.json();
      toast.success(`Template ${isEdit ? 'updated' : 'created'} successfully`);
      navigate(`/templates`);
    } catch (error) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = (values) => {
    setPreviewMode(true);
    // Replace variables with preview data
    let content = values.content;
    values.variables.forEach((variable) => {
      const value = previewData[variable.name] || variable.defaultValue || `{{${variable.name}}}`;
      content = content.replace(new RegExp(`{{${variable.name}}}`, 'g'), value);
    });
    return content;
  };

  const extractVariables = (content) => {
    const regex = /{{(\w+)}}/g;
    const matches = [...content.matchAll(regex)];
    return [...new Set(matches.map(match => match[1]))];
  };

  const initialValues = template
    ? {
        name: template.name,
        category: template.category,
        description: template.description || '',
        content: template.content,
        variables: template.variables || [],
        tags: template.tags || [],
        isPublic: template.isPublic || false,
      }
    : {
        name: '',
        category: '',
        description: '',
        content: '',
        variables: [],
        tags: [],
        isPublic: false,
      };

  if (loading) {
    return <Loading fullscreen />;
  }

  return (
    <div className="template-form-container">
      <div className="form-header">
        <h1>{isEdit ? 'Edit Template' : 'Create Template'}</h1>
        <button
          onClick={() => navigate('/templates')}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>

      <Formik
        initialValues={initialValues}
        enableReinitialize
        validationSchema={templateSchema}
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, setFieldValue, isSubmitting }) => (
          <Form className="template-form">
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-group">
                <label htmlFor="name">Template Name *</label>
                <Field
                  type="text"
                  id="name"
                  name="name"
                  className={`form-control ${errors.name && touched.name ? 'error' : ''}`}
                  placeholder="e.g., Standard NDA Template"
                />
                {errors.name && touched.name && (
                  <div className="error-message">{errors.name}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <Field
                  as="select"
                  id="category"
                  name="category"
                  className={`form-control ${errors.category && touched.category ? 'error' : ''}`}
                >
                  <option value="">Select category</option>
                  <option value="Non-Disclosure Agreement">Non-Disclosure Agreement</option>
                  <option value="Service Agreement">Service Agreement</option>
                  <option value="Purchase Agreement">Purchase Agreement</option>
                  <option value="Employment Contract">Employment Contract</option>
                  <option value="Lease Agreement">Lease Agreement</option>
                  <option value="Partnership Agreement">Partnership Agreement</option>
                  <option value="Other">Other</option>
                </Field>
                {errors.category && touched.category && (
                  <div className="error-message">{errors.category}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <Field
                  as="textarea"
                  id="description"
                  name="description"
                  rows={3}
                  className="form-control"
                  placeholder="Brief description of this template"
                />
              </div>

              <div className="form-group">
                <label>
                  <Field type="checkbox" name="isPublic" />
                  <span className="checkbox-label">
                    Make this template public (visible in marketplace)
                  </span>
                </label>
              </div>
            </div>

            <div className="form-section">
              <h3>Template Content *</h3>
              <p className="help-text">
                Use {"{{variable_name}}"} to create dynamic variables in your template
              </p>
              
              <ContractEditor
                content={values.content}
                onChange={(content) => {
                  setFieldValue('content', content);
                  // Auto-detect variables
                  const detectedVars = extractVariables(content);
                  const existingVarNames = values.variables.map(v => v.name);
                  const newVars = detectedVars.filter(v => !existingVarNames.includes(v));
                  
                  if (newVars.length > 0) {
                    const newVariables = [...values.variables];
                    newVars.forEach(varName => {
                      newVariables.push({
                        name: varName,
                        type: 'text',
                        defaultValue: '',
                        required: false,
                      });
                    });
                    setFieldValue('variables', newVariables);
                  }
                }}
              />
              {errors.content && touched.content && (
                <div className="error-message">{errors.content}</div>
              )}
            </div>

            <div className="form-section">
              <h3>Template Variables</h3>
              <p className="help-text">
                Define the variables used in your template
              </p>
              
              <FieldArray name="variables">
                {({ push, remove }) => (
                  <>
                    {values.variables.map((variable, index) => (
                      <div key={index} className="variable-group">
                        <div className="form-row">
                          <div className="form-group">
                            <label>Variable Name</label>
                            <Field
                              name={`variables.${index}.name`}
                              className="form-control"
                              placeholder="e.g., company_name"
                            />
                          </div>

                          <div className="form-group">
                            <label>Type</label>
                            <Field
                              as="select"
                              name={`variables.${index}.type`}
                              className="form-control"
                            >
                              {variableTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </Field>
                          </div>

                          <div className="form-group">
                            <label>Default Value</label>
                            <Field
                              name={`variables.${index}.defaultValue`}
                              className="form-control"
                              placeholder="Optional default"
                            />
                          </div>

                          <div className="form-group checkbox-group">
                            <label>
                              <Field
                                type="checkbox"
                                name={`variables.${index}.required`}
                              />
                              Required
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="btn btn-link btn-remove"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => push({
                        name: '',
                        type: 'text',
                        defaultValue: '',
                        required: false,
                      })}
                      className="btn btn-secondary"
                    >
                      Add Variable
                    </button>
                  </>
                )}
              </FieldArray>
            </div>

            <div className="form-section">
              <h3>Tags</h3>
              <Select
                isMulti
                name="tags"
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'confidential', label: 'Confidential' },
                  { value: 'short-term', label: 'Short Term' },
                  { value: 'long-term', label: 'Long Term' },
                  { value: 'international', label: 'International' },
                ]}
                value={values.tags.map(tag => ({ value: tag, label: tag }))}
                onChange={(selected) => setFieldValue('tags', selected ? selected.map(s => s.value) : [])}
                placeholder="Add tags..."
                className="tag-select"
              />
            </div>

            {values.variables.length > 0 && (
              <div className="form-section">
                <h3>Preview</h3>
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className="btn btn-secondary"
                >
                  {previewMode ? 'Edit Mode' : 'Preview Mode'}
                </button>
                
                {previewMode && (
                  <div className="preview-section">
                    <h4>Variable Values (for preview)</h4>
                    {values.variables.map((variable) => (
                      <div key={variable.name} className="form-group">
                        <label>{variable.name}</label>
                        <input
                          type={variable.type === 'number' ? 'number' : 'text'}
                          value={previewData[variable.name] || ''}
                          onChange={(e) => setPreviewData({
                            ...previewData,
                            [variable.name]: e.target.value
                          })}
                          className="form-control"
                          placeholder={variable.defaultValue || `Enter ${variable.name}`}
                        />
                      </div>
                    ))}
                    
                    <div className="preview-content">
                      <h4>Preview Output</h4>
                      <div
                        className="contract-preview"
                        dangerouslySetInnerHTML={{ __html: handlePreview(values) }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/templates')}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
}

export default TemplateForm;