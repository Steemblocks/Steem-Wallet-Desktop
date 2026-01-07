/**
 * Encrypted Key Storage Service
 * 
 * This service provides secure storage for private keys by encrypting them
 * with the user's app lock password using AES-256-GCM encryption.
 * 
 * Security Model:
 * - All private keys are encrypted before being stored
 * - Encryption uses Argon2id for key derivation (memory-hard, GPU-resistant)
 * - AES-256-GCM provides authenticated encryption
 * - Keys are only decrypted in memory when needed for signing
 * - The app lock password is never stored, only used for encryption/decryption
 */

import { SecureStorageFactory } from './secureStorage';

// Prefix for encrypted key storage
const ENCRYPTED_KEY_PREFIX = 'encrypted_';
const KEY_ENCRYPTION_ENABLED = 'key_encryption_enabled';

/**
 * Custom error class for session expiration
 * This allows callers to distinguish between "no key exists" and "session expired"
 */
export class SessionExpiredError extends Error {
  constructor(message: string = 'Session expired. Please lock and unlock the app to continue.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Dispatch a session expired event that the app can listen to
 * This allows the app to show the lock screen when the session expires
 */
export function dispatchSessionExpiredEvent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('session-expired', {
      detail: { reason: 'Password cache expired' }
    }));
  }
}

export interface EncryptedKeyData {
  ciphertext: string;
  nonce: string;
  tag: string;
  salt: string;
}

/**
 * Check if we're in Tauri environment
 */
function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    '__TAURI__' in window ||
    '__TAURI_INTERNALS__' in window ||
    (window as { __TAURI_IPC__?: unknown }).__TAURI_IPC__ !== undefined
  );
}

/**
 * Encrypt sensitive data using Rust backend (AES-256-GCM + Argon2id)
 */
export async function encryptData(data: string, password: string): Promise<string> {
  if (!isTauriEnvironment()) {
    // Fallback for web: base64 encode (NOT secure, just for development)
    console.warn('Encryption not available in web mode - using base64 encoding');
    return btoa(encodeURIComponent(data));
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke('encrypt_sensitive_data', {
    data,
    password,
  }) as { success: boolean; encrypted_data?: string; error?: string };

  if (!result.success || !result.encrypted_data) {
    throw new Error(result.error || 'Encryption failed');
  }

  return result.encrypted_data;
}

/**
 * Decrypt sensitive data using Rust backend
 */
export async function decryptData(encryptedData: string, password: string): Promise<string> {
  if (!isTauriEnvironment()) {
    // Fallback for web: base64 decode
    console.warn('Decryption not available in web mode - using base64 decoding');
    try {
      return decodeURIComponent(atob(encryptedData));
    } catch {
      return encryptedData; // Return as-is if not encoded
    }
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke('decrypt_sensitive_data', {
    encryptedData,
    password,
  }) as { success: boolean; decrypted_data?: string; error?: string };

  if (!result.success || !result.decrypted_data) {
    throw new Error(result.error || 'Decryption failed');
  }

  return result.decrypted_data;
}

/**
 * Encrypted Key Storage Service
 * Handles secure storage of private keys encrypted with app lock password
 */
class EncryptedKeyStorageService {
  private static instance: EncryptedKeyStorageService;
  private storage = SecureStorageFactory.getInstance();
  private cachedPassword: string | null = null;
  private passwordCacheTimeout: NodeJS.Timeout | null = null;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private constructor() {}

  static getInstance(): EncryptedKeyStorageService {
    if (!EncryptedKeyStorageService.instance) {
      EncryptedKeyStorageService.instance = new EncryptedKeyStorageService();
    }
    return EncryptedKeyStorageService.instance;
  }

  /**
   * Cache the password temporarily for batch operations
   * Password is cleared after CACHE_DURATION or when explicitly cleared
   */
  cachePassword(password: string): void {
    this.cachedPassword = password;
    
    // Clear any existing timeout
    if (this.passwordCacheTimeout) {
      clearTimeout(this.passwordCacheTimeout);
    }
    
    // Set new timeout to clear password
    this.passwordCacheTimeout = setTimeout(() => {
      this.clearPasswordCache();
    }, this.CACHE_DURATION);
  }

  /**
   * Clear the cached password
   */
  clearPasswordCache(): void {
    this.cachedPassword = null;
    if (this.passwordCacheTimeout) {
      clearTimeout(this.passwordCacheTimeout);
      this.passwordCacheTimeout = null;
    }
  }

  /**
   * Check if a password is currently cached
   */
  isPasswordCached(): boolean {
    return this.cachedPassword !== null;
  }

  /**
   * Get the cached password (for internal use)
   */
  getCachedPassword(): string | null {
    return this.cachedPassword;
  }

  /**
   * Get the cached password or throw if not available
   */
  private getPassword(providedPassword?: string): string {
    const password = providedPassword || this.cachedPassword;
    if (!password) {
      // Dispatch event so the app can show the lock screen
      dispatchSessionExpiredEvent();
      throw new SessionExpiredError();
    }
    
    // Refresh the cache timeout when password is used (keeps session active)
    if (!providedPassword && this.cachedPassword) {
      this.refreshCacheTimeout();
    }
    
    return password;
  }

  /**
   * Refresh the cache timeout (called when password is used)
   */
  private refreshCacheTimeout(): void {
    if (this.passwordCacheTimeout) {
      clearTimeout(this.passwordCacheTimeout);
    }
    this.passwordCacheTimeout = setTimeout(() => {
      this.clearPasswordCache();
    }, this.CACHE_DURATION);
  }

  /**
   * Check if key encryption is enabled
   */
  async isEncryptionEnabled(): Promise<boolean> {
    const enabled = await this.storage.getItem(KEY_ENCRYPTION_ENABLED);
    return enabled === 'true';
  }

  /**
   * Enable key encryption (called when app lock is set up)
   */
  async enableEncryption(): Promise<void> {
    await this.storage.setItem(KEY_ENCRYPTION_ENABLED, 'true');
  }

  /**
   * Store an encrypted private key
   */
  async storeEncryptedKey(
    keyType: string,
    username: string,
    privateKey: string,
    password?: string
  ): Promise<void> {
    const pwd = this.getPassword(password);
    const storageKey = `${ENCRYPTED_KEY_PREFIX}${username}_${keyType}`;
    
    // Encrypt the private key
    const encryptedData = await encryptData(privateKey, pwd);
    
    // Store the encrypted data
    await this.storage.setItem(storageKey, encryptedData);
  }

  /**
   * Retrieve and decrypt a private key
   */
  async getDecryptedKey(
    keyType: string,
    username: string,
    password?: string
  ): Promise<string | null> {
    const pwd = this.getPassword(password);
    const storageKey = `${ENCRYPTED_KEY_PREFIX}${username}_${keyType}`;
    
    // Get the encrypted data
    const encryptedData = await this.storage.getItem(storageKey);
    if (!encryptedData) {
      return null;
    }
    
    // Decrypt and return
    try {
      return await decryptData(encryptedData, pwd);
    } catch (error) {
      console.error(`Failed to decrypt ${keyType} key for ${username}:`, error);
      throw new Error('Failed to decrypt key. Incorrect password?');
    }
  }

  /**
   * Check if a key exists (without decrypting)
   */
  async hasKey(keyType: string, username: string): Promise<boolean> {
    const storageKey = `${ENCRYPTED_KEY_PREFIX}${username}_${keyType}`;
    const data = await this.storage.getItem(storageKey);
    return data !== null;
  }

  /**
   * Remove an encrypted key
   */
  async removeKey(keyType: string, username: string): Promise<void> {
    const storageKey = `${ENCRYPTED_KEY_PREFIX}${username}_${keyType}`;
    await this.storage.removeItem(storageKey);
  }

  /**
   * Re-encrypt all keys with a new password
   * Used when changing the app lock password
   */
  async reEncryptAllKeys(
    oldPassword: string,
    newPassword: string,
    usernames: string[]
  ): Promise<void> {
    const keyTypes = ['owner', 'active', 'posting', 'memo', 'master'];
    
    for (const username of usernames) {
      for (const keyType of keyTypes) {
        try {
          // Try to get and decrypt with old password
          const decryptedKey = await this.getDecryptedKey(keyType, username, oldPassword);
          if (decryptedKey) {
            // Re-encrypt with new password
            await this.storeEncryptedKey(keyType, username, decryptedKey, newPassword);
          }
        } catch {
          // Key might not exist or couldn't be decrypted, skip
          continue;
        }
      }
    }
  }

  /**
   * Migrate unencrypted keys to encrypted storage
   * Called when encryption is first enabled
   */
  async migrateToEncrypted(password: string, usernames: string[]): Promise<void> {
    const keyTypes = ['owner', 'active', 'posting', 'memo'];
    const legacyKeyMap: Record<string, string> = {
      owner: 'owner_key',
      active: 'active_key',
      posting: 'posting_key',
      memo: 'memo_key',
    };
    
    for (const username of usernames) {
      const prefix = `account_${username}_`;
      
      for (const keyType of keyTypes) {
        try {
          // Get the unencrypted key from legacy storage
          const legacyKey = await this.storage.getItem(`${prefix}${legacyKeyMap[keyType]}`);
          if (legacyKey) {
            // Encrypt and store
            await this.storeEncryptedKey(keyType, username, legacyKey, password);
            // Remove the unencrypted key
            await this.storage.removeItem(`${prefix}${legacyKeyMap[keyType]}`);
          }
        } catch (error) {
          console.error(`Failed to migrate ${keyType} key for ${username}:`, error);
        }
      }
      
      // Also migrate master password if exists
      try {
        const masterPassword = await this.storage.getItem(`${prefix}master_password`);
        if (masterPassword) {
          await this.storeEncryptedKey('master', username, masterPassword, password);
          await this.storage.removeItem(`${prefix}master_password`);
        }
      } catch (error) {
        console.error(`Failed to migrate master password for ${username}:`, error);
      }
    }
    
    // Also clean up legacy global keys
    const legacyGlobalKeys = [
      'steem_owner_key',
      'steem_active_key', 
      'steem_posting_key',
      'steem_memo_key',
      'steem_master_password',
    ];
    
    for (const key of legacyGlobalKeys) {
      await this.storage.removeItem(key);
    }
    
    // Mark encryption as enabled
    await this.enableEncryption();
  }
}

export const encryptedKeyStorage = EncryptedKeyStorageService.getInstance();
export default EncryptedKeyStorageService;
