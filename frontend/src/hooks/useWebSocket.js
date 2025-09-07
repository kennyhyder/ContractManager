import { useEffect, useRef, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import io from 'socket.io-client';

export function useWebSocket() {
  const { user, token } = useSelector((state) => state.auth);
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!user || !token || socketRef.current?.connected) return;

    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
    
    socketRef.current = io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, don't auto-reconnect
        socketRef.current.connect();
      }
    });

    socketRef.current.on('reconnecting', (attemptNumber) => {
      console.log(`Reconnecting... Attempt ${attemptNumber}`);
      setReconnecting(true);
      reconnectAttemptsRef.current = attemptNumber;
    });

    socketRef.current.on('reconnect_failed', () => {
      console.error('Failed to reconnect after maximum attempts');
      setReconnecting(false);
    });

    socketRef.current.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return socketRef.current;
  }, [user, token]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected. Unable to emit:', event);
    }
  }, []);

  const on = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  const off = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
    }
  }, []);

  useEffect(() => {
    if (process.env.REACT_APP_ENABLE_WEBSOCKETS !== 'true') {
      return;
    }

    const socket = connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    connected,
    reconnecting,
    reconnectAttempts: reconnectAttemptsRef.current,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}