/**
 * Mobile Application Architecture
 * React Native implementation with offline sync, push notifications, and biometric auth
 * @module MobileApp
 */

// ============= MAIN APP COMPONENT =============
// App.js

import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  Platform,
  AppState,
  Alert
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import TouchID from 'react-native-touch-id';
import FaceID from 'react-native-face-id';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

// Import screens
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ContractListScreen from './screens/ContractListScreen';
import ContractDetailScreen from './screens/ContractDetailScreen';
import OfflineScreen from './screens/OfflineScreen';

// Import services
import { store, persistor } from './store';
import AuthService from './services/AuthService';
import OfflineSyncService from './services/OfflineSyncService';
import PushNotificationService from './services/PushNotificationService';
import BiometricService from './services/BiometricService';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    // Initialize services
    initializeApp();
    
    // App state listener
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Network state listener
    const unsubscribeNetInfo = NetInfo.addEventListener(handleConnectivityChange);
    
    return () => {
      appStateSubscription.remove();
      unsubscribeNetInfo();
    };
  }, []);

  /**
   * Initialize app services
   */
  const initializeApp = async () => {
    try {
      // Check authentication
      const token = await AuthService.getToken();
      setIsAuthenticated(!!token);
      
      // Initialize push notifications
      await PushNotificationService.initialize();
      
      // Initialize offline sync
      await OfflineSyncService.initialize();
      
      // Check biometric availability
      await BiometricService.checkAvailability();
      
      // Hide splash screen
      setTimeout(() => {
        SplashScreen.hide();
      }, 1500);
    } catch (error) {
      console.error('App initialization error:', error);
    }
  };

  /**
   * Handle app state changes
   */
  const handleAppStateChange = (nextAppState) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to foreground
      OfflineSyncService.syncPendingData();
    }
    setAppState(nextAppState);
  };

  /**
   * Handle connectivity changes
   */
  const handleConnectivityChange = (state) => {
    setIsOffline(!state.isConnected);
    
    if (state.isConnected && !isOffline) {
      // Back online - sync data
      OfflineSyncService.syncPendingData();
    }
  };

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar
            barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
            backgroundColor="#2563eb"
          />
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName={isAuthenticated ? 'Home' : 'Login'}
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#2563eb',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
              <Stack.Screen 
                name="Login" 
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Home" 
                component={HomeScreen}
                options={{ title: 'Contracts' }}
              />
              <Stack.Screen 
                name="ContractList" 
                component={ContractListScreen}
                options={{ title: 'My Contracts' }}
              />
              <Stack.Screen 
                name="ContractDetail" 
                component={ContractDetailScreen}
                options={{ title: 'Contract Details' }}
              />
              <Stack.Screen 
                name="Offline" 
                component={OfflineScreen}
                options={{ title: 'Offline Mode' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaView>
      </PersistGate>
    </Provider>
  );
}

// ============= OFFLINE SYNC SERVICE =============
// services/OfflineSyncService.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

class OfflineSyncService {
  constructor() {
    this.syncQueue = [];
    this.isSyncing = false;
    this.encryptionKey = null;
    this.conflictResolutionStrategy = 'client-wins'; // or 'server-wins', 'manual'
  }

  /**
   * Initialize offline sync service
   */
  async initialize() {
    try {
      // Load encryption key
      this.encryptionKey = await this.getOrCreateEncryptionKey();
      
      // Load pending sync items
      await this.loadSyncQueue();
      
      // Set up periodic sync
      this.setupPeriodicSync();
      
      // Listen for connectivity changes
      NetInfo.addEventListener(this.handleConnectivityChange.bind(this));
    } catch (error) {
      console.error('OfflineSync initialization error:', error);
    }
  }

  /**
   * Add item to sync queue
   */
  async addToSyncQueue(operation) {
    const syncItem = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      operation: operation.type, // 'create', 'update', 'delete'
      entity: operation.entity, // 'contract', 'signature', etc.
      data: await this.encryptData(operation.data),
      status: 'pending',
      retryCount: 0,
      conflictResolution: null
    };

    this.syncQueue.push(syncItem);
    await this.saveSyncQueue();
    
    // Try to sync immediately if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      this.syncPendingData();
    }
  }

  /**
   * Sync pending data
   */
  async syncPendingData() {
    if (this.isSyncing || this.syncQueue.length === 0) return;
    
    this.isSyncing = true;
    const pendingItems = this.syncQueue.filter(item => item.status === 'pending');
    
    for (const item of pendingItems) {
      try {
        await this.syncItem(item);
      } catch (error) {
        console.error(`Sync error for item ${item.id}:`, error);
        await this.handleSyncError(item, error);
      }
    }
    
    this.isSyncing = false;
    await this.saveSyncQueue();
  }

  /**
   * Sync individual item
   */
  async syncItem(item) {
    const decryptedData = await this.decryptData(item.data);
    
    // Check for conflicts
    const conflict = await this.checkForConflicts(item);
    if (conflict) {
      await this.resolveConflict(item, conflict);
      return;
    }
    
    // Perform sync operation
    let response;
    switch (item.operation) {
      case 'create':
        response = await API.create(item.entity, decryptedData);
        break;
      case 'update':
        response = await API.update(item.entity, decryptedData.id, decryptedData);
        break;
      case 'delete':
        response = await API.delete(item.entity, decryptedData.id);
        break;
    }
    
    // Update local data with server response
    await this.updateLocalData(item, response);
    
    // Mark as synced
    item.status = 'synced';
    item.syncedAt = new Date().toISOString();
  }

  /**
   * Check for conflicts
   */
  async checkForConflicts(item) {
    if (item.operation !== 'update') return null;
    
    const decryptedData = await this.decryptData(item.data);
    const serverData = await API.get(item.entity, decryptedData.id);
    
    if (!serverData) return null;
    
    // Compare timestamps
    const localTimestamp = new Date(decryptedData.updatedAt);
    const serverTimestamp = new Date(serverData.updatedAt);
    
    if (serverTimestamp > localTimestamp) {
      return {
        type: 'update-conflict',
        localData: decryptedData,
        serverData: serverData
      };
    }
    
    return null;
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(item, conflict) {
    switch (this.conflictResolutionStrategy) {
      case 'client-wins':
        // Force update with local data
        await API.forceUpdate(item.entity, conflict.localData.id, conflict.localData);
        item.status = 'synced';
        break;
        
      case 'server-wins':
        // Discard local changes
        await this.updateLocalData(item, conflict.serverData);
        item.status = 'discarded';
        break;
        
      case 'manual':
        // Store conflict for manual resolution
        item.status = 'conflict';
        item.conflict = conflict;
        // Notify user
        this.notifyConflict(item, conflict);
        break;
    }
  }

  /**
   * Handle sync error
   */
  async handleSyncError(item, error) {
    item.retryCount++;
    item.lastError = error.message;
    
    if (item.retryCount >= 3) {
      item.status = 'failed';
      // Notify user of sync failure
      this.notifySyncFailure(item);
    } else {
      // Schedule retry
      setTimeout(() => {
        this.syncItem(item);
      }, Math.pow(2, item.retryCount) * 1000); // Exponential backoff
    }
  }

  /**
   * Encrypt data for storage
   */
  async encryptData(data) {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, this.encryptionKey).toString();
  }

  /**
   * Decrypt stored data
   */
  async decryptData(encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  }

  /**
   * Save sync queue to storage
   */
  async saveSyncQueue() {
    try {
      await AsyncStorage.setItem('@sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  /**
   * Load sync queue from storage
   */
  async loadSyncQueue() {
    try {
      const data = await AsyncStorage.getItem('@sync_queue');
      this.syncQueue = data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading sync queue:', error);
      this.syncQueue = [];
    }
  }
}

export default new OfflineSyncService();

// ============= PUSH NOTIFICATION SERVICE =============
// services/PushNotificationService.js

import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidStyle, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class PushNotificationService {
  constructor() {
    this.notificationHandlers = new Map();
    this.channelId = 'contract-platform-channel';
  }

  /**
   * Initialize push notifications
   */
  async initialize() {
    try {
      // Request permissions
      await this.requestPermissions();
      
      // Create notification channel (Android)
      if (Platform.OS === 'android') {
        await this.createNotificationChannel();
      }
      
      // Get FCM token
      await this.getFCMToken();
      
      // Set up message handlers
      this.setupMessageHandlers();
      
      // Handle notification interactions
      this.setupNotificationHandlers();
    } catch (error) {
      console.error('Push notification initialization error:', error);
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions() {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('Notification permissions not granted');
    }
    
    return enabled;
  }

  /**
   * Create notification channel for Android
   */
  async createNotificationChannel() {
    await notifee.createChannel({
      id: this.channelId,
      name: 'Contract Platform',
      description: 'Notifications for contract updates and activities',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#2563eb'
    });
  }

  /**
   * Get FCM token
   */
  async getFCMToken() {
    try {
      const token = await messaging().getToken();
      console.log('FCM Token:', token);
      
      // Save token
      await AsyncStorage.setItem('@fcm_token', token);
      
      // Send token to server
      await this.sendTokenToServer(token);
      
      // Listen for token refresh
      messaging().onTokenRefresh(async (newToken) => {
        await AsyncStorage.setItem('@fcm_token', newToken);
        await this.sendTokenToServer(newToken);
      });
    } catch (error) {
      console.error('Error getting FCM token:', error);
    }
  }

  /**
   * Setup message handlers
   */
  setupMessageHandlers() {
    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      await this.displayNotification(remoteMessage);
    });

    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      await this.handleBackgroundMessage(remoteMessage);
    });

    // Handle notification opened from quit state
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        this.handleNotificationOpen(remoteMessage);
      }
    });

    // Handle notification opened from background
    messaging().onNotificationOpenedApp((remoteMessage) => {
      this.handleNotificationOpen(remoteMessage);
    });
  }

  /**
   * Display notification
   */
  async displayNotification(remoteMessage) {
    const { title, body, data } = remoteMessage.notification || {};
    
    // Build notification
    const notification = {
      title: title || 'Contract Update',
      body: body || 'You have a new update',
      android: {
        channelId: this.channelId,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
          launchActivity: 'default'
        },
        style: this.getNotificationStyle(data),
        actions: this.getNotificationActions(data)
      },
      ios: {
        categoryId: data?.category || 'default',
        sound: 'default',
        badge: data?.badge || 1
      },
      data: data || {}
    };

    // Display notification
    await notifee.displayNotification(notification);
  }

  /**
   * Get notification style based on type
   */
  getNotificationStyle(data) {
    if (data?.type === 'contract_signed') {
      return {
        type: AndroidStyle.BIGTEXT,
        text: data.details || 'A contract has been signed and is ready for review.'
      };
    }
    
    if (data?.type === 'message') {
      return {
        type: AndroidStyle.MESSAGING,
        person: {
          name: data.senderName || 'Contract Platform',
          icon: data.senderAvatar
        },
        messages: [{
          text: data.message,
          timestamp: Date.now()
        }]
      };
    }
    
    return null;
  }

  /**
   * Get notification actions based on type
   */
  getNotificationActions(data) {
    const actions = [];
    
    if (data?.type === 'signature_request') {
      actions.push(
        {
          title: 'Sign Now',
          pressAction: {
            id: 'sign',
            launchActivity: 'default'
          }
        },
        {
          title: 'View Contract',
          pressAction: {
            id: 'view',
            launchActivity: 'default'
          }
        }
      );
    }
    
    if (data?.type === 'comment') {
      actions.push({
        title: 'Reply',
        pressAction: {
          id: 'reply',
          launchActivity: 'default'
        },
        input: {
          placeholder: 'Type your reply...',
          allowFreeFormInput: true
        }
      });
    }
    
    return actions;
  }

  /**
   * Handle notification interactions
   */
  setupNotificationHandlers() {
    notifee.onForegroundEvent(async ({ type, detail }) => {
      switch (type) {
        case EventType.PRESS:
          this.handleNotificationPress(detail);
          break;
          
        case EventType.ACTION_PRESS:
          this.handleActionPress(detail);
          break;
          
        case EventType.DISMISSED:
          this.handleNotificationDismiss(detail);
          break;
      }
    });
  }

  /**
   * Register notification handler
   */
  registerHandler(type, handler) {
    this.notificationHandlers.set(type, handler);
  }

  /**
   * Handle notification press
   */
  handleNotificationPress(notification) {
    const handler = this.notificationHandlers.get(notification.data?.type);
    if (handler) {
      handler(notification);
    } else {
      // Default navigation
      this.navigateToScreen(notification.data);
    }
  }
}

export default new PushNotificationService();

// ============= BIOMETRIC AUTHENTICATION SERVICE =============
// services/BiometricService.js

import TouchID from 'react-native-touch-id';
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

class BiometricService {
  constructor() {
    this.isAvailable = false;
    this.biometryType = null;
    this.config = {
      title: 'Authentication Required',
      imageColor: '#2563eb',
      imageErrorColor: '#ff0000',
      sensorDescription: 'Touch sensor',
      sensorErrorDescription: 'Failed',
      cancelText: 'Cancel',
      fallbackLabel: 'Use Passcode',
      unifiedErrors: false,
      passcodeFallback: true
    };
  }

  /**
   * Check biometric availability
   */
  async checkAvailability() {
    try {
      const biometryType = await TouchID.isSupported();
      this.isAvailable = true;
      this.biometryType = biometryType;
      
      // Store availability status
      await AsyncStorage.setItem('@biometric_available', 'true');
      await AsyncStorage.setItem('@biometric_type', biometryType);
      
      return {
        available: true,
        biometryType: biometryType
      };
    } catch (error) {
      this.isAvailable = false;
      await AsyncStorage.setItem('@biometric_available', 'false');
      
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Authenticate with biometrics
   */
  async authenticate(reason = 'Authenticate to access your contracts') {
    if (!this.isAvailable) {
      throw new Error('Biometric authentication not available');
    }
    
    try {
      const config = {
        ...this.config,
        title: reason
      };
      
      const biometryType = await TouchID.authenticate(reason, config);
      
      // Log successful authentication
      await this.logAuthentication(true);
      
      return {
        success: true,
        biometryType: biometryType
      };
    } catch (error) {
      // Log failed authentication
      await this.logAuthentication(false, error.code);
      
      throw error;
    }
  }

  /**
   * Store credentials with biometric protection
   */
  async storeCredentials(username, password) {
    try {
      // Encrypt credentials
      const encryptedPassword = CryptoJS.AES.encrypt(password, username).toString();
      
      // Store in keychain with biometric protection
      await Keychain.setInternetCredentials(
        'contract-platform',
        username,
        encryptedPassword,
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
          authenticatePrompt: 'Authenticate to save credentials'
        }
      );
      
      // Store username for quick access
      await AsyncStorage.setItem('@stored_username', username);
      
      return true;
    } catch (error) {
      console.error('Error storing credentials:', error);
      throw error;
    }
  }

  /**
   * Retrieve credentials with biometric authentication
   */
  async retrieveCredentials() {
    try {
      const username = await AsyncStorage.getItem('@stored_username');
      if (!username) {
        throw new Error('No stored credentials found');
      }
      
      // Retrieve from keychain with biometric authentication
      const credentials = await Keychain.getInternetCredentials(
        'contract-platform',
        {
          authenticatePrompt: 'Authenticate to access your credentials'
        }
      );
      
      if (credentials) {
        // Decrypt password
        const bytes = CryptoJS.AES.decrypt(credentials.password, credentials.username);
        const decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);
        
        return {
          username: credentials.username,
          password: decryptedPassword
        };
      }
      
      throw new Error('Failed to retrieve credentials');
    } catch (error) {
      console.error('Error retrieving credentials:', error);
      throw error;
    }
  }

  /**
   * Enable biometric authentication
   */
  async enableBiometric() {
    try {
      // Check availability first
      const availability = await this.checkAvailability();
      if (!availability.available) {
        throw new Error('Biometric authentication not available on this device');
      }
      
      // Test authentication
      await this.authenticate('Enable biometric authentication for quick access');
      
      // Store preference
      await AsyncStorage.setItem('@biometric_enabled', 'true');
      
      return true;
    } catch (error) {
      console.error('Error enabling biometric:', error);
      throw error;
    }
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometric() {
    try {
      // Clear stored credentials
      await Keychain.resetInternetCredentials('contract-platform');
      
      // Clear preferences
      await AsyncStorage.removeItem('@biometric_enabled');
      await AsyncStorage.removeItem('@stored_username');
      
      return true;
    } catch (error) {
      console.error('Error disabling biometric:', error);
      throw error;
    }
  }

  /**
   * Check if biometric is enabled
   */
  async isBiometricEnabled() {
    const enabled = await AsyncStorage.getItem('@biometric_enabled');
    return enabled === 'true';
  }

  /**
   * Log authentication attempt
   */
  async logAuthentication(success, errorCode = null) {
    const log = {
      timestamp: new Date().toISOString(),
      success: success,
      biometryType: this.biometryType,
      errorCode: errorCode,
      platform: Platform.OS,
      deviceId: await this.getDeviceId()
    };
    
    // Store locally
    const logs = await this.getAuthenticationLogs();
    logs.push(log);
    
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.shift();
    }
    
    await AsyncStorage.setItem('@biometric_logs', JSON.stringify(logs));
    
    // Send to server if online
    if (success) {
      this.sendLogToServer(log);
    }
  }

  /**
   * Get authentication logs
   */
  async getAuthenticationLogs() {
    try {
      const logs = await AsyncStorage.getItem('@biometric_logs');
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      return [];
    }
  }
}

export default new BiometricService();

// ============= REDUX STORE CONFIGURATION =============
// store/index.js

import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

// Import reducers
import authReducer from './slices/authSlice';
import contractsReducer from './slices/contractsSlice';
import offlineReducer from './slices/offlineSlice';
import notificationsReducer from './slices/notificationsSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'contracts', 'offline'], // Only persist these reducers
  blacklist: ['notifications'] // Don't persist notifications
};

// Combine reducers
const rootReducer = combineReducers({
  auth: authReducer,
  contracts: contractsReducer,
  offline: offlineReducer,
  notifications: notificationsReducer
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
      }
    })
});

export const persistor = persistStore(store);

// ============= MOBILE-SPECIFIC UI COMPONENTS =============
// components/MobileComponents.js

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Haptics from 'react-native-haptic-feedback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Floating Action Button
 */
export const FloatingActionButton = ({ onPress, icon, style }) => {
  const scaleAnim = new Animated.Value(1);
  
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true
    }).start();
    
    // Haptic feedback
    Haptics.trigger('impactLight');
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true
    }).start();
  };
  
  return (
    <Animated.View
      style={[
        styles.fab,
        { transform: [{ scale: scaleAnim }] },
        style
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.fabButton}
      >
        {icon}
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Swipeable List Item
 */
export const SwipeableListItem = ({ 
  children, 
  onSwipeLeft, 
  onSwipeRight,
  leftAction,
  rightAction 
}) => {
  const translateX = new Animated.Value(0);
  const itemHeight = new Animated.Value(70);
  
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 5;
    },
    onPanResponderMove: (evt, gestureState) => {
      translateX.setValue(gestureState.dx);
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dx > SCREEN_WIDTH * 0.3) {
        // Swipe right
        onSwipeRight && onSwipeRight();
      } else if (gestureState.dx < -SCREEN_WIDTH * 0.3) {
        // Swipe left
        onSwipeLeft && onSwipeLeft();
      } else {
        // Reset position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true
        }).start();
      }
    }
  });
  
  return (
    <View style={styles.swipeableContainer}>
      {leftAction && (
        <View style={[styles.swipeAction, styles.leftAction]}>
          {leftAction}
        </View>
      )}
      {rightAction && (
        <View style={[styles.swipeAction, styles.rightAction]}>
          {rightAction}
        </View>
      )}
      <Animated.View
        style={[
          styles.swipeableItem,
          { transform: [{ translateX }] }
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

/**
 * Pull to Refresh
 */
export const PullToRefresh = ({ onRefresh, children }) => {
  const [refreshing, setRefreshing] = useState(false);
  const translateY = new Animated.Value(0);
  const rotateAnim = new Animated.Value(0);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Start rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true
      })
    ).start();
    
    // Haptic feedback
    Haptics.trigger('impactMedium');
    
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
    }
  };
  
  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#2563eb"
          colors={['#2563eb']}
        />
      }
    >
      {children}
    </ScrollView>
  );
};

/**
 * Bottom Sheet
 */
export const BottomSheet = ({ visible, onClose, children, height = 400 }) => {
  const translateY = new Animated.Value(height);
  const insets = useSafeAreaInsets();
  
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: height,
        duration: 250,
        useNativeDriver: true
      }).start();
    }
  }, [visible]);
  
  if (!visible) return null;
  
  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
    >
      <TouchableOpacity
        style={styles.bottomSheetOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.bottomSheetContent,
            {
              height: height + insets.bottom,
              transform: [{ translateY }]
            }
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.bottomSheetHandle} />
            <View style={{ paddingBottom: insets.bottom }}>
              {children}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  fabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  swipeableContainer: {
    position: 'relative',
    marginBottom: 1
  },
  swipeableItem: {
    backgroundColor: 'white',
    zIndex: 1
  },
  swipeAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center'
  },
  leftAction: {
    left: 0,
    backgroundColor: '#4ade80'
  },
  rightAction: {
    right: 0,
    backgroundColor: '#ef4444'
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  bottomSheetContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10
  }
});