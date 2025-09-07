// tests/frontend/unit/hooks/useAuth.test.js
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import useAuth from '../../../../frontend/src/hooks/useAuth';
import * as api from '../../../../frontend/src/services/api';

jest.mock('../../../../frontend/src/services/api');

const mockStore = configureStore([]);

describe('useAuth Hook', () => {
  let store;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );

  describe('Initial State', () => {
    it('should return unauthenticated state initially', () => {
      store = mockStore({
        auth: {
          user: null,
          token: null,
          isAuthenticated: false
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should restore session from localStorage', () => {
      const savedUser = { id: '1', email: 'saved@example.com' };
      const savedToken = 'saved-token';
      
      localStorage.setItem('user', JSON.stringify(savedUser));
      localStorage.setItem('token', savedToken);

      store = mockStore({
        auth: {
          user: savedUser,
          token: savedToken,
          isAuthenticated: true
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.user).toEqual(savedUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Login', () => {
    it('should login successfully', async () => {
      store = mockStore({
        auth: {
          user: null,
          token: null,
          isAuthenticated: false
        }
      });

      const mockResponse = {
        data: {
          user: { id: '1', email: 'test@example.com' },
          token: 'test-token'
        }
      };

      api.login.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      expect(api.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      });

      expect(localStorage.getItem('token')).toBe('test-token');
      expect(JSON.parse(localStorage.getItem('user'))).toEqual(mockResponse.data.user);
    });

    it('should handle login error', async () => {
      store = mockStore({
        auth: {
          user: null,
          token: null,
          isAuthenticated: false
        }
      });

      api.login.mockRejectedValue(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'wrong-password');
        } catch (error) {
          expect(error.message).toBe('Invalid credentials');
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      store = mockStore({
        auth: {
          user: { id: '1', email: 'test@example.com' },
          token: 'test-token',
          isAuthenticated: true
        }
      });

      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: '1' }));

      api.logout.mockResolvedValue({ data: { message: 'Logged out' } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.logout();
      });

      expect(api.logout).toHaveBeenCalled();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token automatically', async () => {
      jest.useFakeTimers();
      
      store = mockStore({
        auth: {
          user: { id: '1', email: 'test@example.com' },
          token: 'old-token',
          isAuthenticated: true
        }
      });

      api.refreshToken.mockResolvedValue({
        data: { token: 'new-token' }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Fast-forward time to trigger refresh
      act(() => {
        jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
      });

      await act(async () => {
        await Promise.resolve(); // Wait for async operations
      });

      expect(api.refreshToken).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('Permissions', () => {
    it('should check user permissions', () => {
      store = mockStore({
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            role: 'manager',
            permissions: ['contracts.create', 'contracts.edit', 'contracts.delete']
          },
          token: 'test-token',
          isAuthenticated: true
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.hasPermission('contracts.create')).toBe(true);
      expect(result.current.hasPermission('users.manage')).toBe(false);
      expect(result.current.hasRole('manager')).toBe(true);
      expect(result.current.hasRole('admin')).toBe(false);
    });
  });
});