import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import './Auth.css';

const forgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
});

const resetPasswordSchema = Yup.object().shape({
  code: Yup.string()
    .length(6, 'Code must be 6 characters')
    .required('Verification code is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    )
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),
});

function ForgotPassword() {
  const [step, setStep] = useState('request'); // 'request' or 'reset'
  const [email, setEmail] = useState('');

  const handleRequestReset = async (values, { setSubmitting }) => {
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) throw new Error('Failed to send reset email');

      setEmail(values.email);
      setStep('reset');
      toast.success('Password reset code sent to your email');
    } catch (error) {
      toast.error('Failed to send reset email. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (values, { setSubmitting }) => {
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: values.code,
          password: values.password,
        }),
      });

      if (!response.ok) throw new Error('Failed to reset password');

      toast.success('Password reset successfully! You can now login.');
      window.location.href = '/login';
    } catch (error) {
      toast.error('Failed to reset password. Please check your code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) throw new Error('Failed to resend code');

      toast.success('New code sent to your email');
    } catch (error) {
      toast.error('Failed to resend code. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Reset Password</h1>
          <p>
            {step === 'request'
              ? 'Enter your email to receive a password reset code'
              : 'Enter the code from your email and create a new password'}
          </p>
        </div>

        {step === 'request' ? (
          <Formik
            initialValues={{ email: '' }}
            validationSchema={forgotPasswordSchema}
            onSubmit={handleRequestReset}
          >
            {({ errors, touched, isSubmitting }) => (
              <Form className="auth-form">
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <Field
                    type="email"
                    id="email"
                    name="email"
                    className={`form-control ${errors.email && touched.email ? 'error' : ''}`}
                    placeholder="you@example.com"
                  />
                  {errors.email && touched.email && (
                    <div className="error-message">{errors.email}</div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary btn-block"
                >
                  {isSubmitting ? 'Sending...' : 'Send Reset Code'}
                </button>
              </Form>
            )}
          </Formik>
        ) : (
          <Formik
            initialValues={{
              code: '',
              password: '',
              confirmPassword: '',
            }}
            validationSchema={resetPasswordSchema}
            onSubmit={handleResetPassword}
          >
            {({ errors, touched, isSubmitting }) => (
              <Form className="auth-form">
                <div className="form-group">
                  <label htmlFor="code">Verification Code</label>
                  <Field
                    type="text"
                    id="code"
                    name="code"
                    className={`form-control ${errors.code && touched.code ? 'error' : ''}`}
                    placeholder="Enter 6-digit code"
                    maxLength="6"
                  />
                  {errors.code && touched.code && (
                    <div className="error-message">{errors.code}</div>
                  )}
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="resend-link"
                  >
                    Resend code
                  </button>
                </div>

                <div className="form-group">
                  <label htmlFor="password">New Password</label>
                  <Field
                    type="password"
                    id="password"
                    name="password"
                    className={`form-control ${errors.password && touched.password ? 'error' : ''}`}
                    placeholder="Create a new password"
                  />
                  {errors.password && touched.password && (
                    <div className="error-message">{errors.password}</div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <Field
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className={`form-control ${errors.confirmPassword && touched.confirmPassword ? 'error' : ''}`}
                    placeholder="Confirm your new password"
                  />
                  {errors.confirmPassword && touched.confirmPassword && (
                    <div className="error-message">{errors.confirmPassword}</div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary btn-block"
                >
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </Form>
            )}
          </Formik>
        )}

        <div className="auth-footer">
          <p>
            Remember your password?{' '}
            <Link to="/login" className="link">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;