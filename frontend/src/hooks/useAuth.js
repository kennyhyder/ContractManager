import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { logout, refreshToken } from '../store/authSlice';

export function useAuth() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading, error } = useSelector((state) => state.auth);

  const checkAuth = useCallback(() => {
    return isAuthenticated && user;
  }, [isAuthenticated, user]);

  const hasRole = useCallback((role) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.role === role;
  }, [user]);

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.includes(permission);
  }, [user]);

  const signOut = useCallback(async () => {
    await dispatch(logout());
    navigate('/login');
  }, [dispatch, navigate]);

  const refresh = useCallback(async () => {
    try {
      await dispatch(refreshToken()).unwrap();
      return true;
    } catch (error) {
      return false;
    }
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    checkAuth,
    hasRole,
    hasPermission,
    logout: signOut,
    refreshToken: refresh,
  };
}