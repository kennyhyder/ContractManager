import apiService from './api';

class AuthService {
  constructor() {
    this.tokenKey = 'auth_token';
    this.refreshTokenKey = 'refresh_token';
    this.userKey = 'user_data';
  }

  // Token management
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token) {
    localStorage.setItem(this.tokenKey, token);
  }

  removeToken() {
    localStorage.removeItem(this.tokenKey);
  }

  getRefreshToken() {
    return localStorage.getItem(this.refreshTokenKey);
  }

  setRefreshToken(token) {
    localStorage.setItem(this.refreshTokenKey, token);
  }

  removeRefreshToken() {
    localStorage.removeItem(this.refreshTokenKey);
  }

  // User data management
  getUser() {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  setUser(user) {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  removeUser() {
    localStorage.removeItem(this.userKey);
  }

  // Authentication methods
  async login(credentials) {
    const response = await apiService.auth.login(credentials);
    const { token, refreshToken, user } = response.data;
    
    this.setToken(token);
    this.setRefreshToken(refreshToken);
    this.setUser(user);
    
    return response.data;
  }

  async register(userData) {
    const response = await apiService.auth.register(userData);
    return response.data;
  }

  async logout() {
    try {
      await apiService.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await apiService.auth.refreshToken();
      const { token } = response.data;
      
      this.setToken(token);
      return token;
    } catch (error) {
      this.clearAuth();
      throw error;
    }
  }

  async verifyEmail(token) {
    const response = await apiService.auth.verifyEmail(token);
    return response.data;
  }

  async forgotPassword(email) {
    const response = await apiService.auth.forgotPassword(email);
    return response.data;
  }

  async resetPassword(token, password) {
    const response = await apiService.auth.resetPassword({ token, password });
    return response.data;
  }

  // OAuth methods
  async loginWithGoogle() {
    window.location.href = `${process.env.REACT_APP_API_URL}/auth/google`;
  }

  async loginWithMicrosoft() {
    window.location.href = `${process.env.REACT_APP_API_URL}/auth/microsoft`;
  }

  async handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const refreshToken = urlParams.get('refreshToken');
    
    if (token && refreshToken) {
      this.setToken(token);
      this.setRefreshToken(refreshToken);
      
      // Get user data
      const user = await this.getCurrentUser();
      this.setUser(user);
      
      return { token, refreshToken, user };
    }
    
    throw new Error('OAuth callback failed');
  }

  // Two-factor authentication
  async enableTwoFactor() {
    const response = await apiService.users.enable2FA();
    return response.data;
  }

  async disableTwoFactor(code) {
    const response = await apiService.users.disable2FA(code);
    return response.data;
  }

  async verifyTwoFactor(email, code) {
    const response = await apiService.auth.verifyTwoFactor({ email, code });
    const { token, refreshToken, user } = response.data;
    
    this.setToken(token);
    this.setRefreshToken(refreshToken);
    this.setUser(user);
    
    return response.data;
  }

  // Utility methods
  isAuthenticated() {
    const token = this.getToken();
    const user = this.getUser();
    return !!(token && user);
  }

  async getCurrentUser() {
    const response = await apiService.users.getById('me');
    return response.data;
  }

  clearAuth() {
    this.removeToken();
    this.removeRefreshToken();
    this.removeUser();
  }

  // Session management
  startSessionTimeout() {
    const sessionTimeout = process.env.REACT_APP_SESSION_TIMEOUT || 30 * 60 * 1000; // 30 minutes
    
    this.sessionTimer = setTimeout(() => {
      this.logout();
      window.location.href = '/login?reason=session_expired';
    }, sessionTimeout);
  }

  resetSessionTimeout() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    this.startSessionTimeout();
  }

  stopSessionTimeout() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }
}

export default new AuthService();