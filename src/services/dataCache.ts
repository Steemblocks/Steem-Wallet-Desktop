/**
 * Data Cache Service for Steem Wallet
 * Provides persistent caching of wallet data across app restarts
 * Uses Tauri's secure storage when available, falls back to localStorage
 */

import { SecureStorageFactory } from '@/services/secureStorage';

// Cache keys
const CACHE_KEYS = {
  WALLET_DATA: 'cache_wallet_data',
  WITNESSES: 'cache_witnesses',
  DELEGATIONS: 'cache_delegations',
  PRICE_DATA: 'cache_price_data',
  ACCOUNT_HISTORY: 'cache_account_history',
  GLOBAL_PROPS: 'cache_global_props',
  LAST_UPDATED: 'cache_last_updated',
} as const;

// Cache TTL (time to live) in milliseconds
const CACHE_TTL = {
  WALLET_DATA: 5 * 60 * 1000,    // 5 minutes - account balances change frequently
  WITNESSES: 30 * 60 * 1000,     // 30 minutes - witness data changes slowly
  DELEGATIONS: 10 * 60 * 1000,   // 10 minutes - delegations don't change often
  PRICE_DATA: 2 * 60 * 1000,     // 2 minutes - prices can fluctuate
  ACCOUNT_HISTORY: 5 * 60 * 1000, // 5 minutes - history updates with activity
  GLOBAL_PROPS: 60 * 60 * 1000,  // 1 hour - global props rarely change
} as const;

export interface CachedData<T> {
  data: T;
  timestamp: number;
  username?: string;
}

interface CacheTimestamps {
  walletData?: number;
  witnesses?: number;
  delegations?: number;
  priceData?: number;
  accountHistory?: number;
  globalProps?: number;
}

class DataCacheService {
  private static instance: DataCacheService | null = null;
  private memoryCache: Map<string, CachedData<any>> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): DataCacheService {
    if (!DataCacheService.instance) {
      DataCacheService.instance = new DataCacheService();
    }
    return DataCacheService.instance;
  }

  /**
   * Initialize the cache service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Load cached timestamps to check what's still valid
      const storage = SecureStorageFactory.getInstance();
      const timestampsStr = await storage.getItem(CACHE_KEYS.LAST_UPDATED);
      
      if (timestampsStr) {
        const timestamps: CacheTimestamps = JSON.parse(timestampsStr);
        console.log('[DataCache] Found existing cache timestamps:', timestamps);
      }
      
      this.initialized = true;
      console.log('[DataCache] Cache service initialized');
    } catch (error) {
      console.warn('[DataCache] Failed to initialize cache:', error);
      this.initialized = true; // Continue even on error
    }
  }

  /**
   * Get username-specific cache key
   */
  private getUserCacheKey(baseKey: string, username?: string): string {
    return username ? `${baseKey}_${username}` : baseKey;
  }

  /**
   * Check if cached data is still valid
   */
  private isValid(cached: CachedData<any> | null, ttl: number): boolean {
    if (!cached) return false;
    return Date.now() - cached.timestamp < ttl;
  }

  /**
   * Get cached data from memory or storage
   */
  async get<T>(key: string, username?: string): Promise<T | null> {
    const cacheKey = this.getUserCacheKey(key, username);
    
    // Check memory cache first
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached) {
      return memoryCached.data;
    }
    
    // Fall back to persistent storage
    try {
      const storage = SecureStorageFactory.getInstance();
      const storedStr = await storage.getItem(cacheKey);
      
      if (storedStr) {
        const cached: CachedData<T> = JSON.parse(storedStr);
        // Store in memory for faster future access
        this.memoryCache.set(cacheKey, cached);
        return cached.data;
      }
    } catch (error) {
      console.warn('[DataCache] Error reading cache:', key, error);
    }
    
    return null;
  }

  /**
   * Check if cached data is valid
   */
  async isValidCache(key: string, ttl: number, username?: string): Promise<boolean> {
    const cacheKey = this.getUserCacheKey(key, username);
    
    // Check memory cache first
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached && this.isValid(memoryCached, ttl)) {
      return true;
    }
    
    // Check persistent storage
    try {
      const storage = SecureStorageFactory.getInstance();
      const storedStr = await storage.getItem(cacheKey);
      
      if (storedStr) {
        const cached: CachedData<any> = JSON.parse(storedStr);
        return this.isValid(cached, ttl);
      }
    } catch (error) {
      // Ignore errors, return false
    }
    
    return false;
  }

  /**
   * Set cached data to both memory and persistent storage
   */
  async set<T>(key: string, data: T, username?: string): Promise<void> {
    const cacheKey = this.getUserCacheKey(key, username);
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      username,
    };
    
    // Store in memory
    this.memoryCache.set(cacheKey, cached);
    
    // Store in persistent storage (non-blocking)
    try {
      const storage = SecureStorageFactory.getInstance();
      await storage.setItem(cacheKey, JSON.stringify(cached));
      
      // Update timestamps
      await this.updateTimestamp(key);
    } catch (error) {
      console.warn('[DataCache] Error writing cache:', key, error);
    }
  }

  /**
   * Update the timestamp for a cache key
   */
  private async updateTimestamp(key: string): Promise<void> {
    try {
      const storage = SecureStorageFactory.getInstance();
      const timestampsStr = await storage.getItem(CACHE_KEYS.LAST_UPDATED);
      const timestamps: CacheTimestamps = timestampsStr ? JSON.parse(timestampsStr) : {};
      
      // Map cache key to timestamp key
      const keyMap: Record<string, keyof CacheTimestamps> = {
        [CACHE_KEYS.WALLET_DATA]: 'walletData',
        [CACHE_KEYS.WITNESSES]: 'witnesses',
        [CACHE_KEYS.DELEGATIONS]: 'delegations',
        [CACHE_KEYS.PRICE_DATA]: 'priceData',
        [CACHE_KEYS.ACCOUNT_HISTORY]: 'accountHistory',
        [CACHE_KEYS.GLOBAL_PROPS]: 'globalProps',
      };
      
      const timestampKey = keyMap[key];
      if (timestampKey) {
        timestamps[timestampKey] = Date.now();
        await storage.setItem(CACHE_KEYS.LAST_UPDATED, JSON.stringify(timestamps));
      }
    } catch (error) {
      // Non-critical, ignore errors
    }
  }

  /**
   * Clear all cached data for a specific user
   */
  async clearUserCache(username: string): Promise<void> {
    const userKeys = [
      CACHE_KEYS.WALLET_DATA,
      CACHE_KEYS.DELEGATIONS,
      CACHE_KEYS.ACCOUNT_HISTORY,
    ];
    
    try {
      const storage = SecureStorageFactory.getInstance();
      
      for (const key of userKeys) {
        const cacheKey = this.getUserCacheKey(key, username);
        this.memoryCache.delete(cacheKey);
        await storage.removeItem(cacheKey);
      }
      
      console.log('[DataCache] Cleared cache for user:', username);
    } catch (error) {
      console.warn('[DataCache] Error clearing user cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    try {
      const storage = SecureStorageFactory.getInstance();
      
      // Clear memory cache
      this.memoryCache.clear();
      
      // Clear all cache keys from storage
      const allKeys = Object.values(CACHE_KEYS);
      for (const key of allKeys) {
        await storage.removeItem(key);
      }
      
      console.log('[DataCache] Cleared all cache data');
    } catch (error) {
      console.warn('[DataCache] Error clearing all cache:', error);
    }
  }

  // ============= Specific cache methods =============

  /**
   * Cache wallet data for a user
   */
  async cacheWalletData(username: string, data: any): Promise<void> {
    await this.set(CACHE_KEYS.WALLET_DATA, data, username);
  }

  /**
   * Get cached wallet data for a user
   */
  async getWalletData(username: string): Promise<any | null> {
    const isValid = await this.isValidCache(
      CACHE_KEYS.WALLET_DATA, 
      CACHE_TTL.WALLET_DATA, 
      username
    );
    
    if (isValid) {
      return this.get(CACHE_KEYS.WALLET_DATA, username);
    }
    return null;
  }

  /**
   * Cache witnesses data
   */
  async cacheWitnesses(data: any[]): Promise<void> {
    await this.set(CACHE_KEYS.WITNESSES, data);
  }

  /**
   * Get cached witnesses
   */
  async getWitnesses(): Promise<any[] | null> {
    const isValid = await this.isValidCache(CACHE_KEYS.WITNESSES, CACHE_TTL.WITNESSES);
    
    if (isValid) {
      return this.get(CACHE_KEYS.WITNESSES);
    }
    return null;
  }

  /**
   * Cache delegations for a user
   */
  async cacheDelegations(username: string, data: any[]): Promise<void> {
    await this.set(CACHE_KEYS.DELEGATIONS, data, username);
  }

  /**
   * Get cached delegations for a user
   */
  async getDelegations(username: string): Promise<any[] | null> {
    const isValid = await this.isValidCache(
      CACHE_KEYS.DELEGATIONS, 
      CACHE_TTL.DELEGATIONS, 
      username
    );
    
    if (isValid) {
      return this.get(CACHE_KEYS.DELEGATIONS, username);
    }
    return null;
  }

  /**
   * Cache price data
   */
  async cachePriceData(data: any): Promise<void> {
    await this.set(CACHE_KEYS.PRICE_DATA, data);
  }

  /**
   * Get cached price data
   */
  async getPriceData(): Promise<any | null> {
    const isValid = await this.isValidCache(CACHE_KEYS.PRICE_DATA, CACHE_TTL.PRICE_DATA);
    
    if (isValid) {
      return this.get(CACHE_KEYS.PRICE_DATA);
    }
    return null;
  }

  /**
   * Cache account history for a user
   */
  async cacheAccountHistory(username: string, data: any[]): Promise<void> {
    await this.set(CACHE_KEYS.ACCOUNT_HISTORY, data, username);
  }

  /**
   * Get cached account history for a user
   */
  async getAccountHistory(username: string): Promise<any[] | null> {
    const isValid = await this.isValidCache(
      CACHE_KEYS.ACCOUNT_HISTORY, 
      CACHE_TTL.ACCOUNT_HISTORY, 
      username
    );
    
    if (isValid) {
      return this.get(CACHE_KEYS.ACCOUNT_HISTORY, username);
    }
    return null;
  }

  /**
   * Cache global properties
   */
  async cacheGlobalProps(data: any): Promise<void> {
    await this.set(CACHE_KEYS.GLOBAL_PROPS, data);
  }

  /**
   * Get cached global properties
   */
  async getGlobalProps(): Promise<any | null> {
    const isValid = await this.isValidCache(CACHE_KEYS.GLOBAL_PROPS, CACHE_TTL.GLOBAL_PROPS);
    
    if (isValid) {
      return this.get(CACHE_KEYS.GLOBAL_PROPS);
    }
    return null;
  }

  /**
   * Get all cached data for initial load (stale data for quick display)
   * Returns whatever is cached, even if expired (for immediate display while fetching fresh)
   */
  async getStaleDataForQuickLoad(username: string): Promise<{
    walletData: any | null;
    witnesses: any[] | null;
    delegations: any[] | null;
    priceData: any | null;
    accountHistory: any[] | null;
  }> {
    const [walletData, witnesses, delegations, priceData, accountHistory] = await Promise.all([
      this.get<any>(CACHE_KEYS.WALLET_DATA, username),
      this.get<any[]>(CACHE_KEYS.WITNESSES),
      this.get<any[]>(CACHE_KEYS.DELEGATIONS, username),
      this.get<any>(CACHE_KEYS.PRICE_DATA),
      this.get<any[]>(CACHE_KEYS.ACCOUNT_HISTORY, username),
    ]);
    
    return {
      walletData: walletData || null,
      witnesses: witnesses || null,
      delegations: delegations || null,
      priceData: priceData || null,
      accountHistory: accountHistory || null,
    };
  }
}

// Export singleton instance
export const dataCache = DataCacheService.getInstance();

// Export cache keys and TTL for external use
export { CACHE_KEYS, CACHE_TTL };
