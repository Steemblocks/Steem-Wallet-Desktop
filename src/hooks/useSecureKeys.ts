/**
 * Hook for securely accessing decrypted keys
 * Keys are stored encrypted and decrypted on-demand using the cached app lock password
 */

import { useState, useEffect, useCallback } from 'react';
import { accountManager } from '@/services/accountManager';
import { SecureStorageFactory } from '@/services/secureStorage';

interface UseSecureKeysResult {
  username: string | null;
  loginMethod: string | null;
  isLoading: boolean;
  error: string | null;
  getKey: (keyType: 'owner' | 'active' | 'posting' | 'memo') => Promise<string | null>;
  hasKey: (keyType: 'owner' | 'active' | 'posting' | 'memo') => Promise<boolean>;
}

/**
 * Hook to securely access account keys
 * Keys are decrypted on-demand and not stored in React state for security
 */
export function useSecureKeys(): UseSecureKeysResult {
  const [username, setUsername] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load basic account info (not the keys themselves)
  useEffect(() => {
    const loadAccountInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        const method = await storage.getItem('steem_login_method');
        
        setUsername(user);
        setLoginMethod(method);
      } catch (err) {
        console.error('Error loading account info:', err);
        setError('Failed to load account information');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAccountInfo();
  }, []);

  /**
   * Get a decrypted key on-demand
   * The key is decrypted using the cached app lock password
   */
  const getKey = useCallback(async (keyType: 'owner' | 'active' | 'posting' | 'memo'): Promise<string | null> => {
    if (!username) {
      console.error('No username available');
      return null;
    }
    
    try {
      // Try to get the decrypted key from encrypted storage
      const decryptedKey = await accountManager.getDecryptedKey(username, keyType);
      if (decryptedKey) {
        return decryptedKey;
      }
    } catch (err) {
      console.error(`Error getting ${keyType} key:`, err);
    }
    
    // Fallback: try legacy unencrypted storage for backward compatibility
    try {
      const storage = SecureStorageFactory.getInstance();
      
      // Try account-specific legacy key first
      const accountLegacyKey = await storage.getItem(`account_${username}_${keyType}_key`);
      if (accountLegacyKey) {
        console.warn(`Using legacy account-specific ${keyType} key - consider re-logging in`);
        return accountLegacyKey;
      }
      
      // Try global legacy key
      const globalLegacyKey = await storage.getItem(`steem_${keyType}_key`);
      if (globalLegacyKey) {
        console.warn(`Using legacy global ${keyType} key - consider re-logging in`);
        return globalLegacyKey;
      }
    } catch {
      // Ignore fallback errors
    }
    
    return null;
  }, [username]);

  /**
   * Check if a key exists (without decrypting)
   */
  const hasKey = useCallback(async (keyType: 'owner' | 'active' | 'posting' | 'memo'): Promise<boolean> => {
    if (!username) return false;
    
    try {
      return await accountManager.hasKey(username, keyType);
    } catch {
      return false;
    }
  }, [username]);

  return {
    username,
    loginMethod,
    isLoading,
    error,
    getKey,
    hasKey,
  };
}

/**
 * Utility function to get a key directly (for use outside of hooks)
 * Requires the app to be unlocked (password cached)
 * @param usernameOrKeyType - Either a username string (when 2 args) or keyType (when 1 arg)
 * @param keyTypeOrUndefined - The keyType when usernameOrKeyType is a username
 */
export async function getDecryptedKey(
  usernameOrKeyType: string | 'owner' | 'active' | 'posting' | 'memo',
  keyTypeOrUndefined?: 'owner' | 'active' | 'posting' | 'memo'
): Promise<string | null> {
  try {
    let username: string | null;
    let keyType: 'owner' | 'active' | 'posting' | 'memo';
    
    // Support both calling conventions:
    // getDecryptedKey('active') - gets username from storage
    // getDecryptedKey('john', 'active') - uses provided username
    if (keyTypeOrUndefined !== undefined) {
      // Two arguments: first is username, second is keyType
      username = usernameOrKeyType;
      keyType = keyTypeOrUndefined;
    } else {
      // One argument: it's the keyType, get username from storage
      keyType = usernameOrKeyType as 'owner' | 'active' | 'posting' | 'memo';
      const storage = SecureStorageFactory.getInstance();
      username = await storage.getItem('steem_username');
    }
    
    if (!username) {
      console.error('No username available');
      return null;
    }
    
    // Try encrypted storage first
    const decryptedKey = await accountManager.getDecryptedKey(username, keyType);
    if (decryptedKey) {
      return decryptedKey;
    }
    
    // Fallback to legacy storage formats (in order of preference)
    const storage = SecureStorageFactory.getInstance();
    
    // Try account-specific legacy key: account_{username}_{type}_key
    const accountLegacyKey = await storage.getItem(`account_${username}_${keyType}_key`);
    if (accountLegacyKey) {
      console.warn(`Using legacy account-specific ${keyType} key - consider re-logging in`);
      return accountLegacyKey;
    }
    
    // Try global legacy key: steem_{type}_key
    const globalLegacyKey = await storage.getItem(`steem_${keyType}_key`);
    if (globalLegacyKey) {
      console.warn(`Using legacy global ${keyType} key - consider re-logging in`);
      return globalLegacyKey;
    }
    
    return null;
  } catch (err) {
    console.error(`Error getting key:`, err);
    return null;
  }
}

export default useSecureKeys;
