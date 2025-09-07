import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Formik, Form, Field, FieldArray } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import { createContract, updateContract, fetchContract } from '../../store/contractSlice';
import ContractEditor from './ContractEditor';
import Loading from '../common/Loading';
import './ContractForm.css';

const contractSchema = Yup.object().shape({
  title: Yup.string().required('Title is required').min(3, 'Title must be at least 3 characters'),
  type: Yup.string().required('Contract type is required'),
  content: Yup.string().required('Contract content is required'),
  parties: Yup.array()
    .of(
      Yup.object().shape({
        name: Yup.string().required('Party name is required'),
        email: Yup.string().email('Invalid email').required('Email is required'),
        role: Yup.string().required('Role is required'),
      })
    )
    .min(2, 'At least two parties are required'),
  value: Yup.number().positive('Value must be positive').nullable(),
  startDate: Yup.date().nullable(),
  endDate: Yup.date()
    .nullable()
    .when('startDate', {
      is: (startDate) => startDate != null,
      then: Yup.date().min(Yup.ref('startDate'), 'End date must be after start date'),
    }),
  tags: Yup.array().of(Yup.string()),
});

const contractTypes = [
  { value: 'nda', label: 'Non-Disclosure Agreement' },
  { value: 'service', label: 'Service Agreement' },
  { value: 'purchase', label: 'Purchase Agreement' },
  { value: 'employment', label: 'Employment Contract' },
  { value: 'lease', label: 'Lease Agreement' },
  { value: 'partnership', label: 'Partnership Agreement' },
  { value: 'other', label: 'Other' },
];

function ContractForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentContract, loading } = useSelector((state) => state.contracts);
  const { user } = useSelector((state) => state.auth);
  
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(id);

  useEffect(() => {
    if (isEdit && id) {
      dispatch(fetchContract(id));
    }
    loadTemplates();
  }, [id, isEdit, dispatch]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates', {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await response.json();
      setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    // Pre-fill form with template data
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const contractData = {
        ...values,
        status: 'draft',
      };

      if (isEdit) {
        await dispatch(updateContract({ id, data: contractData })).unwrap();
        toast.success('Contract updated successfully');
      } else {
        const result = await dispatch(createContract(contractData)).unwrap();
        toast.success('Contract created successfully');
        navigate(`/contracts/${result._id}`);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save contract');
    } finally {
      setSubmitting(false);
    }
  };

  const initialValues = isEdit && currentContract
    ? {
        title: currentContract.title,
        type: currentContract.type,
        content: currentContract.content,
        parties: currentContract.parties || [
          { name: '', email: '', role: 'party1' },
          { name: '', email: '', role: 'party2' },
        ],
        value: currentContract.value || '',
        startDate: currentContract.startDate ? new Date(currentContract.startDate) : null,
        endDate: currentContract.endDate ? new Date(currentContract.endDate) : null,
        tags: currentContract.tags || [],
      }
    : {
        title: '',
        type: '',
        content: '',
        parties: [
          { name: '', email: '', role: 'party1' },
          { name: '', email: '', role: 'party2' },
        ],
        value: '',
        startDate: null,
        endDate: null,
        tags: [],
      };

  if (loading && isEdit) {
    return <Loading fullscreen />;
  }

  return (
    <div className="contract-form-container">
      <div className="form-header">
        <h1>{isEdit ? 'Edit Contract' : 'Create New Contract'}</h1>
        <button
          onClick={() => navigate('/contracts')}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>

      {!isEdit && templates.length > 0 && (
        <div className="template-selector">
          <h3>Start from a template</h3>
          <div className="template-grid">
            {templates.map((template) => (
              <div
                key={template._id}
                className="template-card"
                onClick={() => handleTemplateSelect(template)}
              >
                <h4>{template.name}</h4>
                <p>{template.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Formik
        initialValues={initialValues}
        enableReinitialize
        validationSchema={contractSchema}
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, setFieldValue, isSubmitting }) => (
          <Form className="contract-form">
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-group">
                <label htmlFor="title">Contract Title *</label>
                <Field
                  type="text"
                  id="title"
                  name="title"
                  className={`form-control ${errors.title && touched.title ? 'error' : ''}`}
                  placeholder="Enter contract title"
                />
                {errors.title && touched.title && (
                  <div className="error-message">{errors.title}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="type">Contract Type *</label>
                <Field
                  as="select"
                  id="type"
                  name="type"
                  className={`form-control ${errors.type && touched.type ? 'error' : ''}`}
                >
                  <option value="">Select type</option>
                  {contractTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Field>
                {errors.type && touched.type && (
                  <div className="error-message">{errors.type}</div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="value">Contract Value</label>
                  <Field
                    type="number"
                    id="value"
                    name="value"
                    className="form-control"
                    placeholder="0.00"
                  />
                  {errors.value && touched.value && (
                    <div className="error-message">{errors.value}</div>
                  )}
                </div>

                <div className="form-group">
                  <label>Contract Period</label>
                  <div className="date-range">
                    <DatePicker
                      selected={values.startDate}
                      onChange={(date) => setFieldValue('startDate', date)}
                      placeholderText="Start date"
                      className="form-control"
                    />
                    <span>to</span>
                    <DatePicker
                      selected={values.endDate}
                      onChange={(date) => setFieldValue('endDate', date)}
                      placeholderText="End date"
                      minDate={values.startDate}
                      className="form-control"
                    />
                  </div>
                  {errors.endDate && touched.endDate && (
                    <div className="error-message">{errors.endDate}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Parties</h3>
              <FieldArray name="parties">
                {({ push, remove }) => (
                  <>
                    {values.parties.map((party, index) => (
                      <div key={index} className="party-fields">
                        <h4>Party {index + 1}</h4>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Name *</label>
                            <Field
                              name={`parties.${index}.name`}
                              className="form-control"
                              placeholder="Party name"
                            />
                            {errors.parties?.[index]?.name && touched.parties?.[index]?.name && (
                              <div className="error-message">{errors.parties[index].name}</div>
                            )}
                          </div>

                          <div className="form-group">
                            <label>Email *</label>
                            <Field
                              type="email"
                              name={`parties.${index}.email`}
                              className="form-control"
                              placeholder="email@example.com"
                            />
                            {errors.parties?.[index]?.email && touched.parties?.[index]?.email && (
                              <div className="error-message">{errors.parties[index].email}</div>
                            )}
                          </div>

                          <div className="form-group">
                            <label>Role *</label>
                            <Field
                              name={`parties.${index}.role`}
                              className="form-control"
                              placeholder="e.g., Buyer, Seller"
                            />
                            {errors.parties?.[index]?.role && touched.parties?.[index]?.role && (
                              <div className="error-message">{errors.parties[index].role}</div>
                            )}
                          </div>

                          {values.parties.length > 2 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="btn btn-link btn-remove"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => push({ name: '', email: '', role: '' })}
                      className="btn btn-secondary"
                    >
                      Add Party
                    </button>
                  </>
                )}
              </FieldArray>
            </div>

            <div className="form-section">
              <h3>Contract Content *</h3>
              <ContractEditor
                content={values.content}
                onChange={(content) => setFieldValue('content', content)}
              />
              {errors.content && touched.content && (
                <div className="error-message">{errors.content}</div>
              )}
            </div>

            <div className="form-section">
              <h3>Tags</h3>
              <Select
                isMulti
                name="tags"
                options={[
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'confidential', label: 'Confidential' },
                  { value: 'high-value', label: 'High Value' },
                  { value: 'renewable', label: 'Renewable' },
                ]}
                value={values.tags.map(tag => ({ value: tag, label: tag }))}
                onChange={(selected) => setFieldValue('tags', selected ? selected.map(s => s.value) : [])}
                placeholder="Add tags..."
                className="tag-select"
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/contracts')}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Saving...' : isEdit ? 'Update Contract' : 'Create Contract'}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
}

export default ContractForm;