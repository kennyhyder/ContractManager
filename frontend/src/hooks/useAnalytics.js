import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

export function useAnalytics() {
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  // Track page views
  useEffect(() => {
    if (window.gtag && process.env.REACT_APP_GA_TRACKING_ID) {
      window.gtag('config', process.env.REACT_APP_GA_TRACKING_ID, {
        page_path: location.pathname + location.search,
        user_id: user?._id,
      });
    }

    // Internal analytics
    trackEvent('page_view', {
      path: location.pathname,
      search: location.search,
    });
  }, [location, user]);

  const trackEvent = useCallback(async (eventName, eventData = {}) => {
    // Google Analytics
    if (window.gtag && process.env.REACT_APP_GA_TRACKING_ID) {
      window.gtag('event', eventName, {
        ...eventData,
        user_id: user?._id,
      });
    }

    // Internal analytics API
    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: user ? `Bearer ${user.token}` : '',
        },
        body: JSON.stringify({
          event: eventName,
          data: eventData,
          timestamp: new Date().toISOString(),
          sessionId: getSessionId(),
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }, [user]);

  const trackTiming = useCallback((category, variable, value, label) => {
    if (window.gtag && process.env.REACT_APP_GA_TRACKING_ID) {
      window.gtag('event', 'timing_complete', {
        event_category: category,
        event_label: label,
        value: value,
        name: variable,
      });
    }

    trackEvent('timing', {
      category,
      variable,
      value,
      label,
    });
  }, [trackEvent]);

  const trackError = useCallback((error, fatal = false) => {
    if (window.gtag && process.env.REACT_APP_GA_TRACKING_ID) {
      window.gtag('event', 'exception', {
        description: error.message || error,
        fatal: fatal,
      });
    }

    trackEvent('error', {
      message: error.message || error,
      stack: error.stack,
      fatal,
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackTiming,
    trackError,
  };
}

// Utility function to get or create session ID
function getSessionId() {
  let sessionId = sessionStorage.getItem('sessionId');
  
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('sessionId', sessionId);
  }
  
  return sessionId;
}