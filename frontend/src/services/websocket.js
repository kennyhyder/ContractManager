import io from 'socket.io-client';
import { store } from '../store';
import { addNotification } from '../store/notificationSlice';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) return;

    const state = store.getState();
    const token = state.auth.token;

    if (!token) {
      console.warn('No auth token available for WebSocket connection');
      return;
    }

    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';

    this.socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('user:online');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server forced disconnect, attempt to reconnect
        this.reconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.socket.on('notification', (notification) => {
      store.dispatch(addNotification(notification));
    });

    // Re-attach custom listeners
    this.listeners.forEach((handler, event) => {
      this.socket.on(event, handler);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    
    setTimeout(() => {
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: Socket not connected`);
    }
  }

  on(event, handler) {
    if (this.socket) {
      this.socket.on(event, handler);
      this.listeners.set(event, handler);
    }
  }

  off(event) {
    if (this.socket) {
      this.socket.off(event);
      this.listeners.delete(event);
    }
  }

  // Contract-specific methods
  joinContract(contractId) {
    this.emit('join:contract', { contractId });
  }

  leaveContract(contractId) {
    this.emit('leave:contract', { contractId });
  }

  sendCursorPosition(contractId, position) {
    this.emit('cursor:move', { contractId, ...position });
  }

  sendSelection(contractId, selection) {
    this.emit('cursor:selection', { contractId, selection });
  }

  startTyping(contractId) {
    this.emit('user:typing', { contractId, isTyping: true });
  }

  stopTyping(contractId) {
    this.emit('user:typing', { contractId, isTyping: false });
  }

  // Collaboration methods
  sendComment(contractId, comment) {
    this.emit('comment:add', { contractId, comment });
  }

  updateComment(commentId, content) {
    this.emit('comment:update', { commentId, content });
  }

  deleteComment(commentId) {
    this.emit('comment:delete', { commentId });
  }

  // Presence methods
  updatePresence(status) {
    this.emit('presence:update', { status });
  }

  getActiveUsers(contractId) {
    return new Promise((resolve) => {
      this.emit('users:get', { contractId });
      this.socket.once('users:list', resolve);
    });
  }
}

export default new WebSocketService();