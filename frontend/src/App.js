import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import Loading from './components/common/Loading';
import PrivateRoute from './components/common/PrivateRoute';
import { useWebSocket } from './hooks/useWebSocket';
import { useNotifications } from './hooks/useNotifications';

// Lazy load pages for better performance
const Login = lazy(() => import('./components/auth/Login'));
const Register = lazy(() => import('./components/auth/Register'));
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword'));
const TwoFactorAuth = lazy(() => import('./components/auth/TwoFactorAuth'));

const Dashboard = lazy(() => import('./components/analytics/Dashboard'));
const ContractList = lazy(() => import('./components/contracts/ContractList'));
const ContractDetail = lazy(() => import('./components/contracts/ContractDetail'));
const ContractForm = lazy(() => import('./components/contracts/ContractForm'));

const TemplateList = lazy(() => import('./components/templates/TemplateList'));
const TemplateMarketplace = lazy(() => import('./components/templates/TemplateMarketplace'));

const ApprovalFlow = lazy(() => import('./components/approvals/ApprovalFlow'));

function App() {
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const { connect, disconnect } = useWebSocket();
  const { initialize: initNotifications } = useNotifications();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect WebSocket
      if (process.env.REACT_APP_ENABLE_WEBSOCKETS === 'true') {
        connect();
      }
      
      // Initialize notifications
      initNotifications();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, user, connect, disconnect, initNotifications]);

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<Loading fullscreen />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/2fa" element={<TwoFactorAuth />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="app">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/contracts"
                element={
                  <PrivateRoute>
                    <ContractList />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/contracts/new"
                element={
                  <PrivateRoute requiredRole="editor">
                    <ContractForm />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/contracts/:id"
                element={
                  <PrivateRoute>
                    <ContractDetail />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/contracts/:id/edit"
                element={
                  <PrivateRoute requiredRole="editor">
                    <ContractForm />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/templates"
                element={
                  <PrivateRoute>
                    <TemplateList />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/marketplace"
                element={
                  <PrivateRoute>
                    <TemplateMarketplace />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/approvals"
                element={
                  <PrivateRoute requiredRole="approver">
                    <ApprovalFlow />
                  </PrivateRoute>
                }
              />
              
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default App;