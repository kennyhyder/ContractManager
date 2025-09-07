import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
} from '../store/notificationSlice';
import { useWebSocket } from './useWebSocket';

export function useNotifications() {
  const dispatch = useDispatch();
  const { notifications, unreadCount } = useSelector((state) => state.notifications);
  const { user } = useSelector((state) => state.auth);
  const { socket, connected } = useWebSocket();

  useEffect(() => {
    if (!connected || !socket) return;

    const handleNewNotification = (notification) => {
      dispatch(addNotification(notification));
      
      // Show toast notification
      toast.info(notification.message, {
        onClick: () => {
          if (notification.link) {
            window.location.href = notification.link;
          }
        },
      });

      // Browser notification if enabled
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title || 'Contract Management', {
          body: notification.message,
          icon: '/logo192.png',
          tag: notification._id,
        });
      }
    };

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [connected, socket, dispatch]);

  const initialize = useCallback(async () => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    // Load notifications from server
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load notifications');

      const data = await response.json();
      data.notifications.forEach((notification) => {
        dispatch(addNotification(notification));
      });
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [dispatch, user]);

  const markRead = useCallback(async (notificationId) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      dispatch(markAsRead(notificationId));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [dispatch, user]);

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      dispatch(markAllAsRead());
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [dispatch, user]);

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      dispatch(removeNotification(notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, [dispatch, user]);

  return {
    notifications,
    unreadCount,
    initialize,
    markAsRead: markRead,
    markAllAsRead: markAllRead,
    deleteNotification,
  };
}