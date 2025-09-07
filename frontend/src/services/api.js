import axios from 'axios';
import { store } from '../store';
import { logout, refreshToken } from '../store/authSlice';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        await store.dispatch(refreshToken()).unwrap();
        const state = store.getState();
        const newToken = state.auth.token;
        
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        store.dispatch(logout());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// API methods
const apiService = {
  // Auth
  auth: {
    login: (credentials) => api.post('/auth/login', credentials),
    register: (userData) => api.post('/auth/register', userData),
    logout: () => api.post('/auth/logout'),
    refreshToken: () => api.post('/auth/refresh'),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (data) => api.post('/auth/reset-password', data),
    verifyEmail: (token) => api.post('/auth/verify-email', { token }),
    verifyTwoFactor: (data) => api.post('/auth/verify-2fa', data),
    resendTwoFactor: (email) => api.post('/auth/resend-2fa', { email }),
  },

  // Contracts
  contracts: {
    getAll: (params) => api.get('/contracts', { params }),
    getById: (id) => api.get(`/contracts/${id}`),
    create: (data) => api.post('/contracts', data),
    update: (id, data) => api.put(`/contracts/${id}`, data),
    delete: (id) => api.delete(`/contracts/${id}`),
    updateStatus: (id, status) => api.patch(`/contracts/${id}/status`, { status }),
    sign: (id, signature) => api.post(`/contracts/${id}/sign`, signature),
    getVersions: (id) => api.get(`/contracts/${id}/versions`),
    restoreVersion: (id, versionId) => api.post(`/contracts/${id}/versions/${versionId}/restore`),
    export: (id, format) => api.get(`/contracts/${id}/export`, { 
      params: { format },
      responseType: 'blob'
    }),
    bulkDelete: (ids) => api.post('/contracts/bulk-delete', { ids }),
    bulkUpdate: (ids, updates) => api.post('/contracts/bulk-update', { ids, updates }),
  },

  // Templates
  templates: {
    getAll: (params) => api.get('/templates', { params }),
    getById: (id) => api.get(`/templates/${id}`),
    create: (data) => api.post('/templates', data),
    update: (id, data) => api.put(`/templates/${id}`, data),
    delete: (id) => api.delete(`/templates/${id}`),
    duplicate: (id) => api.post(`/templates/${id}/duplicate`),
    export: (ids) => api.post('/templates/export', { ids }, { responseType: 'blob' }),
    import: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/templates/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
  },

  // Marketplace
  marketplace: {
    getTemplates: (params) => api.get('/marketplace/templates', { params }),
    getTemplate: (id) => api.get(`/marketplace/templates/${id}`),
    purchase: (id) => api.post(`/marketplace/templates/${id}/purchase`),
    rate: (id, rating) => api.post(`/marketplace/templates/${id}/rate`, { rating }),
    publish: (templateId) => api.post('/marketplace/publish', { templateId }),
  },

  // Users
  users: {
    getAll: (params) => api.get('/users', { params }),
    getById: (id) => api.get(`/users/${id}`),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
    updateProfile: (data) => api.put('/users/profile', data),
    changePassword: (data) => api.post('/users/change-password', data),
    uploadAvatar: (file) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    enable2FA: () => api.post('/users/2fa/enable'),
    disable2FA: (code) => api.post('/users/2fa/disable', { code }),
    getActivity: (userId) => api.get(`/users/${userId}/activity`),
  },

  // Comments
  comments: {
    getByContract: (contractId) => api.get(`/contracts/${contractId}/comments`),
    create: (data) => api.post('/comments', data),
    update: (id, data) => api.put(`/comments/${id}`, data),
    delete: (id) => api.delete(`/comments/${id}`),
    resolve: (id) => api.post(`/comments/${id}/resolve`),
  },

  // Approvals
  approvals: {
    getAll: (params) => api.get('/approvals', { params }),
    getById: (id) => api.get(`/approvals/${id}`),
    approve: (id, comment) => api.post(`/approvals/${id}/approve`, { comment }),
    reject: (id, comment) => api.post(`/approvals/${id}/reject`, { comment }),
    getWorkflow: (contractId) => api.get(`/contracts/${contractId}/approval-workflow`),
    createWorkflow: (data) => api.post('/approval-workflows', data),
  },

  // Notifications
  notifications: {
    getAll: () => api.get('/notifications'),
    markAsRead: (id) => api.post(`/notifications/${id}/read`),
    markAllAsRead: () => api.post('/notifications/read-all'),
    delete: (id) => api.delete(`/notifications/${id}`),
    updateSettings: (settings) => api.put('/notifications/settings', settings),
  },

  // Analytics
  analytics: {
    getDashboard: (params) => api.get('/analytics/dashboard', { params }),
    getContractMetrics: (params) => api.get('/analytics/contracts/metrics', { params }),
    getUserActivity: (params) => api.get('/analytics/user-activity', { params }),
    generateReport: (config) => api.post('/analytics/reports/generate', config),
    getSavedReports: () => api.get('/analytics/reports/saved'),
    downloadReport: (id) => api.get(`/analytics/reports/${id}/download`, { responseType: 'blob' }),
    deleteReport: (id) => api.delete(`/analytics/reports/${id}`),
    exportData: (params) => api.get('/analytics/export', { 
      params,
      responseType: 'blob'
    }),
  },

  // Activities
  activities: {
    getAll: (params) => api.get('/activities', { params }),
    getByContract: (contractId) => api.get(`/contracts/${contractId}/activities`),
    getByUser: (userId) => api.get(`/users/${userId}/activities`),
  },

  // Search
  search: {
    contracts: (query) => api.get('/search/contracts', { params: { q: query } }),
    templates: (query) => api.get('/search/templates', { params: { q: query } }),
    users: (query) => api.get('/search/users', { params: { q: query } }),
    global: (query) => api.get('/search', { params: { q: query } }),
  },

  // File uploads
  files: {
    upload: (file, type = 'document') => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      return api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    delete: (fileId) => api.delete(`/files/${fileId}`),
    getSignedUrl: (fileId) => api.get(`/files/${fileId}/signed-url`),
  },
};

export default apiService;