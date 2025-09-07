import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { verifyTwoFactor, resendTwoFactorCode } from '../../store/authSlice';
import './Auth.css';

const twoFactorSchema = Yup.object().shape({
  code: Yup.string()
    .length(6, 'Code must be 6 digits')
    .matches(/^\d+$/, 'Code must contain only numbers')
    .required('Verification code is required'),
});

function TwoFactorAuth() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate('/login');
      return;
    }

    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email, navigate]);

  const handleSubmit = async (values, { setSubmitting, setErrors }) => {
    try {
      await dispatch(verifyTwoFactor({ email, code: values.code })).unwrap();
      toast.success('Verification successful!');
      navigate('/dashboard');
    } catch (error) {
      if (error.message === 'Invalid code') {
        setErrors({ code: 'Invalid verification code' });
      } else {
        toast.error(error.message || 'Verification failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    try {
      await dispatch(resendTwoFactorCode({ email })).unwrap();
      toast.success('New code sent to your email');
      setResendTimer(30);
      setCanResend(false);
      
      // Restart timer
      const timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      toast.error('Failed to resend code');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Two-Factor Authentication</h1>
          <p>
            We've sent a verification code to {email}. 
            Please enter it below to continue.
          </p>
        </div>

        <Formik
          initialValues={{ code: '' }}
          validationSchema={twoFactorSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, isSubmitting }) => (
            <Form className="auth-form">
              <div className="form-group">
                <label htmlFor="code">Verification Code</label>
                <Field
                  type="text"
                  id="code"
                  name="code"
                  className={`form-control code-input ${errors.code && touched.code ? 'error' : ''}`}
                  placeholder="000000"
                  maxLength="6"
                  autoComplete="one-time-code"
                  autoFocus
                />
                {errors.code && touched.code && (
                  <div className="error-message">{errors.code}</div>
                )}
              </div>

              <div className="resend-section">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="resend-button"
                  >
                    Resend Code
                  </button>
                ) : (
                  <p className="resend-timer">
                    Resend code in {resendTimer} seconds
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary btn-block"
              >
                {isSubmitting ? 'Verifying...' : 'Verify'}
              </button>
            </Form>
          )}
        </Formik>

        <div className="auth-footer">
          <p>
            Didn't receive the code? Check your spam folder or{' '}
            <button
              onClick={() => navigate('/login')}
              className="link-button"
            >
              try logging in again
            </button>
          </p>
        </div>

        <div className="security-tips">
          <h3>Security Tips</h3>
          <ul>
            <li>Never share your verification code with anyone</li>
            <li>The code expires in 10 minutes</li>
            <li>If you didn't request this code, please secure your account</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TwoFactorAuth;