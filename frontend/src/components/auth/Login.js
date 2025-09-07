import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { login, loginWithProvider } from '../../store/authSlice';
import './Auth.css';

const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  rememberMe: Yup.boolean(),
});

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error } = useSelector((state) => state.auth);
  
  const [showPassword, setShowPassword] = useState(false);
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const result = await dispatch(login(values)).unwrap();
      
      if (result.requiresTwoFactor) {
        navigate('/2fa', { state: { email: values.email } });
      } else {
        toast.success('Welcome back!');
        navigate(from, { replace: true });
      }
    } catch (error) {
      toast.error(error.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      await dispatch(loginWithProvider(provider)).unwrap();
      toast.success(`Logged in with ${provider}`);
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(`Failed to login with ${provider}`);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to continue to Contract Management</p>
        </div>

        <Formik
          initialValues={{
            email: '',
            password: '',
            rememberMe: false,
          }}
          validationSchema={loginSchema}
          onSubmit={handleSubmit}
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

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-wrapper">
                  <Field
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    className={`form-control ${errors.password && touched.password ? 'error' : ''}`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && touched.password && (
                  <div className="error-message">{errors.password}</div>
                )}
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <Field type="checkbox" name="rememberMe" />
                  <span>Remember me</span>
                </label>
                <Link to="/forgot-password" className="forgot-link">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="alert alert-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="btn btn-primary btn-block"
              >
                {isSubmitting || loading ? 'Signing in...' : 'Sign In'}
              </button>
            </Form>
          )}
        </Formik>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <div className="social-auth">
          <button
            onClick={() => handleSocialLogin('google')}
            className="social-button google"
            disabled={loading}
          >
            <img src="/google-icon.svg" alt="Google" />
            Continue with Google
          </button>
          
          <button
            onClick={() => handleSocialLogin('microsoft')}
            className="social-button microsoft"
            disabled={loading}
          >
            <img src="/microsoft-icon.svg" alt="Microsoft" />
            Continue with Microsoft
          </button>
        </div>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="link">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      <div className="auth-info">
        <h2>Streamline Your Contract Management</h2>
        <ul className="features-list">
          <li>
            <span className="feature-icon">📄</span>
            <span>Create and manage contracts efficiently</span>
          </li>
          <li>
            <span className="feature-icon">✍️</span>
            <span>Digital signatures and approvals</span>
          </li>
          <li>
            <span className="feature-icon">🔔</span>
            <span>Automated reminders and notifications</span>
          </li>
          <li>
            <span className="feature-icon">📊</span>
            <span>Advanced analytics and reporting</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Login;