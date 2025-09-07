class StorageService {
  constructor() {
    this.prefix = 'cms_';
  }

  // Local Storage methods
  setItem(key, value) {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(this.prefix + key, serializedValue);
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  getItem(key) {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }

  clear() {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith(this.prefix))
        .forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }

  // Session Storage methods
  setSessionItem(key, value) {
    try {
      const serializedValue = JSON.stringify(value);
      sessionStorage.setItem(this.prefix + key, serializedValue);
      return true;
    } catch (error) {
      console.error('Error saving to sessionStorage:', error);
      return false;
    }
  }

  getSessionItem(key) {
    try {
      const item = sessionStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from sessionStorage:', error);
      return null;
    }
  }

  removeSessionItem(key) {
    try {
      sessionStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error('Error removing from sessionStorage:', error);
      return false;
    }
  }

  clearSession() {
    try {
      Object.keys(sessionStorage)
        .filter(key => key.startsWith(this.prefix))
        .forEach(key => sessionStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
      return false;
    }
  }

  // Utility methods
  isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }

  getStorageSize() {
    let size = 0;
    
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key) && key.startsWith(this.prefix)) {
        size += localStorage[key].length + key.length;
      }
    }
    
    return size;
  }

  // Contract-specific storage
  saveContractDraft(contractId, data) {
    const key = `contract_draft_${contractId}`;
    const draft = {
      data,
      timestamp: Date.now(),
    };
    return this.setItem(key, draft);
  }

  getContractDraft(contractId) {
    const key = `contract_draft_${contractId}`;
    return this.getItem(key);
  }

  removeContractDraft(contractId) {
    const key = `contract_draft_${contractId}`;
    return this.removeItem(key);
  }

  // User preferences
  savePreferences(preferences) {
    return this.setItem('user_preferences', preferences);
  }

  getPreferences() {
    return this.getItem('user_preferences') || {};
  }

  updatePreference(key, value) {
    const preferences = this.getPreferences();
    preferences[key] = value;
    return this.savePreferences(preferences);
  }

  // Recent items
  addRecentItem(type, item) {
    const key = `recent_${type}`;
    const recent = this.getItem(key) || [];
    
    // Remove if already exists
    const filtered = recent.filter(i => i.id !== item.id);
    
    // Add to beginning
    filtered.unshift({
      ...item,
      timestamp: Date.now(),
    });
    
    // Keep only last 10
    const trimmed = filtered.slice(0, 10);
    
    return this.setItem(key, trimmed);
  }

  getRecentItems(type) {
    const key = `recent_${type}`;
    return this.getItem(key) || [];
  }

  // Filter persistence
  saveFilters(page, filters) {
    const key = `filters_${page}`;
    return this.setItem(key, filters);
  }

  getFilters(page) {
    const key = `filters_${page}`;
    return this.getItem(key);
  }
}

export default new StorageService();