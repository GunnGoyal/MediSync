/**
 * Dashboard Cache Utility
 * Provides localStorage and sessionStorage-based caching for dashboard data
 */

const DashboardCache = {
  // Cache configuration
  CONFIG: {
    DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes default
    ADMIN_TTL: 5 * 60 * 1000,
    PATIENT_TTL: 5 * 60 * 1000,
    DOCTOR_TTL: 5 * 60 * 1000,
    HEALTH_INTEL_TTL: 5 * 60 * 1000,
    
    // Storage type: 'localStorage' (persistent), 'sessionStorage' (session-only), or 'both'
    STORAGE_TYPE: 'localStorage',
    
    // Session storage configuration
    SESSION_TTL: 30 * 60 * 1000, // 30 minutes for session storage
    AUTO_SYNC_SESSION: true, // Auto-sync sessionStorage with localStorage on load
  },
  
  // Current storage backend
  _storageBackend: null,
  _sessionBackend: null,

  /**
   * Initialize storage backend based on configuration
   */
  _initStorageBackend: function() {
    if (this._storageBackend) return; // Already initialized
    
    try {
      // Check localStorage availability
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this._storageBackend = localStorage;
    } catch (e) {
      console.warn('[Cache] localStorage not available:', e.message);
      this._storageBackend = null;
    }
    
    try {
      // Check sessionStorage availability
      const testKey = '__sessionStorage_test__';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      this._sessionBackend = sessionStorage;
    } catch (e) {
      console.warn('[Cache] sessionStorage not available:', e.message);
      this._sessionBackend = null;
    }
  },

  /**
   * Get the appropriate storage based on type
   * @param {string} type - 'local' or 'session'
   * @returns {Storage} The storage object
   */
  _getStorage: function(type = 'local') {
    this._initStorageBackend();
    
    if (type === 'session') {
      return this._sessionBackend;
    }
    return this._storageBackend;
  },

  /**
   * Set storage type configuration
   * @param {string} type - 'localStorage', 'sessionStorage', or 'both'
   */
  setStorageType: function(type) {
    if (['localStorage', 'sessionStorage', 'both'].includes(type)) {
      this.CONFIG.STORAGE_TYPE = type;
      console.log(`[Cache] Storage type changed to: ${type}`);
      return true;
    }
    console.warn('[Cache] Invalid storage type:', type);
    return false;
  },

  /**
   * Get current storage type
   */
  getStorageType: function() {
    return this.CONFIG.STORAGE_TYPE;
  },

  /**
   * Set cache item with optional TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   * @param {string} type - 'local', 'session', or 'both'
   */
  set: function(key, data, ttl = this.CONFIG.DEFAULT_TTL, type = null) {
    type = type || (this.CONFIG.STORAGE_TYPE === 'both' ? 'both' : 
                    this.CONFIG.STORAGE_TYPE === 'sessionStorage' ? 'session' : 'local');
    
    const cacheItem = {
      data: data,
      timestamp: Date.now(),
      ttl: ttl,
    };
    
    const itemData = JSON.stringify(cacheItem);
    let setLocal = false;
    let setSession = false;
    
    // Set in localStorage if configured
    if ((type === 'local' || type === 'both') && this.CONFIG.STORAGE_TYPE !== 'sessionStorage') {
      try {
        const storage = this._getStorage('local');
        if (storage) {
          storage.setItem(`cache_${key}`, itemData);
          setLocal = true;
        }
      } catch (e) {
        console.warn(`[Cache] Failed to set in localStorage ${key}:`, e.message);
      }
    }
    
    // Set in sessionStorage if configured
    if ((type === 'session' || type === 'both') && this.CONFIG.STORAGE_TYPE !== 'localStorage') {
      try {
        const storage = this._getStorage('session');
        if (storage) {
          storage.setItem(`cache_${key}`, itemData);
          setSession = true;
        }
      } catch (e) {
        console.warn(`[Cache] Failed to set in sessionStorage ${key}:`, e.message);
      }
    }
    
    const locations = [];
    if (setLocal) locations.push('localStorage');
    if (setSession) locations.push('sessionStorage');
    
    if (locations.length > 0) {
      console.log(`[Cache] Set: ${key} (${locations.join(', ')})`);
    }
  },

  /**
   * Get cache item if valid (not expired)
   * @param {string} key - Cache key
   * @param {string} type - 'local', 'session', 'both', or null for auto-detect
   * @returns {any|null} Cached data or null if expired/not found
   */
  get: function(key, type = null) {
    type = type || (this.CONFIG.STORAGE_TYPE === 'both' ? 'both' : 
                    this.CONFIG.STORAGE_TYPE === 'sessionStorage' ? 'session' : 'local');
    
    // Try session storage first if requested or in 'both' mode
    if ((type === 'session' || type === 'both') && this._sessionBackend) {
      try {
        const storage = this._getStorage('session');
        if (storage) {
          const cached = storage.getItem(`cache_${key}`);
          if (cached) {
            const cacheItem = JSON.parse(cached);
            const now = Date.now();
            const age = now - cacheItem.timestamp;

            if (age > cacheItem.ttl) {
              console.log(`[Cache] Expired in sessionStorage: ${key}`);
              this.removeFromSession(key);
              // Fall through to check localStorage if in 'both' mode
              if (type !== 'both') return null;
            } else {
              console.log(`[Cache] Hit in sessionStorage: ${key} (age: ${Math.round(age / 1000)}s)`);
              return cacheItem.data;
            }
          }
        }
      } catch (e) {
        console.warn(`[Cache] Failed to get from sessionStorage ${key}:`, e.message);
      }
    }

    // Try localStorage
    if ((type === 'local' || type === 'both') && this._storageBackend) {
      try {
        const storage = this._getStorage('local');
        if (storage) {
          const cached = storage.getItem(`cache_${key}`);
          if (!cached) {
            console.log(`[Cache] Miss: ${key}`);
            return null;
          }

          const cacheItem = JSON.parse(cached);
          const now = Date.now();
          const age = now - cacheItem.timestamp;

          if (age > cacheItem.ttl) {
            console.log(`[Cache] Expired in localStorage: ${key}`);
            this.removeFromLocal(key);
            return null;
          }

          console.log(`[Cache] Hit in localStorage: ${key} (age: ${Math.round(age / 1000)}s)`);
          return cacheItem.data;
        }
      } catch (e) {
        console.warn(`[Cache] Failed to get from localStorage ${key}:`, e.message);
      }
    }
    
    return null;
  },

  /**
   * Check if cache exists and is valid
   * @param {string} key - Cache key
   * @returns {boolean} True if cache exists and is valid
   */
  exists: function(key) {
    return this.get(key) !== null;
  },

  /**
   * Remove cache item from both storages
   * @param {string} key - Cache key
   */
  remove: function(key) {
    this.removeFromLocal(key);
    this.removeFromSession(key);
  },

  /**
   * Remove cache item from localStorage only
   * @param {string} key - Cache key
   */
  removeFromLocal: function(key) {
    try {
      const storage = this._getStorage('local');
      if (storage) {
        storage.removeItem(`cache_${key}`);
        console.log(`[Cache] Removed from localStorage: ${key}`);
      }
    } catch (e) {
      console.warn(`[Cache] Failed to remove from localStorage ${key}:`, e.message);
    }
  },

  /**
   * Remove cache item from sessionStorage only
   * @param {string} key - Cache key
   */
  removeFromSession: function(key) {
    try {
      const storage = this._getStorage('session');
      if (storage) {
        storage.removeItem(`cache_${key}`);
        console.log(`[Cache] Removed from sessionStorage: ${key}`);
      }
    } catch (e) {
      console.warn(`[Cache] Failed to remove from sessionStorage ${key}:`, e.message);
    }
  },

  /**
   * Clear all dashboard cache from both storages
   */
  clearAll: function() {
    this.clearLocal();
    this.clearSession();
  },

  /**
   * Clear all dashboard cache from localStorage only
   */
  clearLocal: function() {
    try {
      const storage = this._getStorage('local');
      if (storage) {
        const keys = Object.keys(storage);
        let cleared = 0;
        keys.forEach((key) => {
          if (key.startsWith('cache_')) {
            storage.removeItem(key);
            cleared++;
          }
        });
        console.log(`[Cache] Cleared ${cleared} items from localStorage`);
      }
    } catch (e) {
      console.warn('[Cache] Failed to clear localStorage:', e.message);
    }
  },

  /**
   * Clear all dashboard cache from sessionStorage only
   */
  clearSession: function() {
    try {
      const storage = this._getStorage('session');
      if (storage) {
        const keys = Object.keys(storage);
        let cleared = 0;
        keys.forEach((key) => {
          if (key.startsWith('cache_')) {
            storage.removeItem(key);
            cleared++;
          }
        });
        console.log(`[Cache] Cleared ${cleared} items from sessionStorage`);
      }
    } catch (e) {
      console.warn('[Cache] Failed to clear sessionStorage:', e.message);
    }
  },

  /**
   * Get cache stats from both storages
   * @returns {object} Cache statistics
   */
  getStats: function() {
    const localStats = this.getLocalStats();
    const sessionStats = this.getSessionStats();
    
    return {
      localStorage: localStats,
      sessionStorage: sessionStats,
      combined: {
        totalItems: localStats.totalItems + sessionStats.totalItems,
        totalSize: this._combineSizes(localStats.totalSize, sessionStats.totalSize),
        expiredCount: localStats.expiredCount + sessionStats.expiredCount,
      }
    };
  },

  /**
   * Get cache stats from localStorage only
   */
  getLocalStats: function() {
    const storage = this._getStorage('local');
    if (!storage) {
      return { totalItems: 0, totalSize: '0 KB', expiredCount: 0, items: [] };
    }

    try {
      const keys = Object.keys(storage);
      const cacheKeys = keys.filter((k) => k.startsWith('cache_'));
      let totalSize = 0;
      let expiredCount = 0;
      const now = Date.now();

      cacheKeys.forEach((key) => {
        const item = storage.getItem(key);
        totalSize += item ? item.length : 0;

        try {
          const cacheItem = JSON.parse(item);
          const age = now - cacheItem.timestamp;
          if (age > cacheItem.ttl) {
            expiredCount++;
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      return {
        totalItems: cacheKeys.length,
        totalSize: (totalSize / 1024).toFixed(2) + ' KB',
        expiredCount: expiredCount,
        items: cacheKeys.map((k) => k.replace('cache_', '')),
      };
    } catch (e) {
      console.warn('[Cache] Failed to get localStorage stats:', e.message);
      return { totalItems: 0, totalSize: '0 KB', expiredCount: 0, items: [] };
    }
  },

  /**
   * Get cache stats from sessionStorage only
   */
  getSessionStats: function() {
    const storage = this._getStorage('session');
    if (!storage) {
      return { totalItems: 0, totalSize: '0 KB', expiredCount: 0, items: [] };
    }

    try {
      const keys = Object.keys(storage);
      const cacheKeys = keys.filter((k) => k.startsWith('cache_'));
      let totalSize = 0;
      let expiredCount = 0;
      const now = Date.now();

      cacheKeys.forEach((key) => {
        const item = storage.getItem(key);
        totalSize += item ? item.length : 0;

        try {
          const cacheItem = JSON.parse(item);
          const age = now - cacheItem.timestamp;
          if (age > cacheItem.ttl) {
            expiredCount++;
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      return {
        totalItems: cacheKeys.length,
        totalSize: (totalSize / 1024).toFixed(2) + ' KB',
        expiredCount: expiredCount,
        items: cacheKeys.map((k) => k.replace('cache_', '')),
      };
    } catch (e) {
      console.warn('[Cache] Failed to get sessionStorage stats:', e.message);
      return { totalItems: 0, totalSize: '0 KB', expiredCount: 0, items: [] };
    }
  },

  /**
   * Combine size strings (from localStorage and sessionStorage)
   */
  _combineSizes: function(size1, size2) {
    const sz1 = parseFloat(size1);
    const sz2 = parseFloat(size2);
    return (sz1 + sz2).toFixed(2) + ' KB';
  },

  /**
   * Cache API response and update DOM
   * @param {string} cacheKey - Key for cache
   * @param {function} apiCall - Function that returns a promise for API call
   * @param {function} updateDOM - Function to update DOM with data
   * @param {object} options - Additional options (ttl, showLoader, etc.)
   */
  fetchAndCache: async function(
    cacheKey,
    apiCall,
    updateDOM,
    options = {}
  ) {
    const {
      ttl = this.CONFIG.DEFAULT_TTL,
      showLoader = true,
      loaderElement = null,
    } = options;

    // Try to get from cache first
    const cachedData = this.get(cacheKey);
    if (cachedData) {
      console.log(`[Cache] Using cached data for ${cacheKey}`);
      updateDOM(cachedData, true);
      return cachedData;
    }

    // Show loader if needed
    if (showLoader && loaderElement) {
      loaderElement.style.display = 'block';
    }

    try {
      // Fetch from API
      const data = await apiCall();

      // Cache the response
      this.set(cacheKey, data, ttl);

      // Update DOM
      updateDOM(data, false);

      // Hide loader
      if (showLoader && loaderElement) {
        loaderElement.style.display = 'none';
      }

      return data;
    } catch (error) {
      console.error(`[Cache] API call failed for ${cacheKey}:`, error);

      // Hide loader
      if (showLoader && loaderElement) {
        loaderElement.style.display = 'none';
      }

      throw error;
    }
  },

  /**
   * Initialize cache with UI controls
   * Disabled - cache control panel UI removed
   */
  initUI: function() {
    // Cache control panel UI has been removed
  },

  /**
   * Update cache stats display
   * Disabled - cache stats display removed
   */
  updateStatsDisplay: function() {
    // Cache stats display has been removed
  },

  /**
   * Add cache refresh button to a specific element
   * @param {string|Element} containerSelector - Selector or element
   * @param {function} refreshCallback - Function to call on refresh
   */
  addRefreshButton: function(containerSelector, refreshCallback) {
    const container =
      typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector;

    if (!container) return;

    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-outline-secondary';
    btn.innerHTML = '🔄 Refresh Data';
    btn.style.marginLeft = '10px';

    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.innerHTML = '⏳ Loading...';

      refreshCallback()
        .then(() => {
          btn.disabled = false;
          btn.innerHTML = '✓ Refreshed!';
          setTimeout(() => {
            btn.innerHTML = '🔄 Refresh Data';
          }, 2000);
        })
        .catch((error) => {
          console.error('Refresh failed:', error);
          btn.disabled = false;
          btn.innerHTML = '❌ Failed';
          setTimeout(() => {
            btn.innerHTML = '🔄 Refresh Data';
          }, 2000);
        });
    });

    container.appendChild(btn);
    return btn;
  },
};

// Make DashboardCache available globally
window.DashboardCache = DashboardCache;

console.log('[Cache] Dashboard Cache utility loaded');
