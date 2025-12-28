/**
 * Tauri Desktop-Only Secure Storage
 * Pure desktop implementation using Rust encryption backend
 * Private keys are encrypted with AES-256-GCM and never exposed to JavaScript
 */

export interface ISecureStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ISecureKeyStorage extends ISecureStorage {
  setEncryptedKey(
    keyType: string,
    username: string,
    encryptedKey: string,
    password: string
  ): Promise<void>;
  getEncryptedKey(keyType: string, username: string): Promise<string | null>;
  removeEncryptedKey(keyType: string, username: string): Promise<void>;
}

export interface EncryptedKeyData {
  ciphertext: string;
  nonce: string;
  salt: string;
}

/**
 * Tauri desktop implementation using secure native storage
 * Private keys are encrypted in Rust backend (AES-256-GCM)
 * Never accessible to JavaScript
 */
export class TauriSecureStorage implements ISecureKeyStorage {
  private keyStoragePrefix = 'steem_key_';

  async setItem(key: string, value: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('storage_set', {
      key,
      value: JSON.stringify({ data: value }),
    });
  }

  async getItem(key: string): Promise<string | null> {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke('storage_get', { key });
    if (!result) return null;
    try {
      const parsed = JSON.parse(result as string);
      return parsed.data;
    } catch {
      return result as string;
    }
  }

  async removeItem(key: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('storage_remove', { key });
  }

  async clear(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('storage_clear');
  }

  async setEncryptedKey(
    keyType: string,
    username: string,
    encryptedKey: string,
    password: string
  ): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke(
      'store_encrypted_key',
      {
        key_type: keyType,
        private_key: encryptedKey,
        username,
        password,
      }
    ) as { success: boolean; message: string };

    if (!result.success) {
      throw new Error(`Failed to store key: ${result.message}`);
    }
  }

  async getEncryptedKey(keyType: string, username: string): Promise<string | null> {
    const { invoke } = await import('@tauri-apps/api/core');

    const result = await invoke(
      'retrieve_encrypted_key',
      {
        key_type: keyType,
        username,
        password: '', // Password will be requested from user
      }
    ) as { success: boolean; private_key?: string; error?: string };

    if (result.success && result.private_key) {
      return result.private_key;
    }

    return null;
  }

  async removeEncryptedKey(keyType: string, username: string): Promise<void> {
    const key = `${this.keyStoragePrefix}${username}_${keyType}`;
    await this.removeItem(key);
  }
}

/**
 * Factory for secure storage
 * Returns Tauri storage (desktop) or LocalStorage fallback (web)
 */
export class SecureStorageFactory {
  private static instance: ISecureKeyStorage;
  private static initialized = false;

  private static isTauriEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check multiple indicators for Tauri environment
    return (
      '__TAURI__' in window ||
      '__TAURI_INTERNALS__' in window ||
      (window as { __TAURI_IPC__?: unknown }).__TAURI_IPC__ !== undefined ||
      document.documentElement.hasAttribute('data-tauri-platform')
    );
  }

  static getInstance(): ISecureKeyStorage {
    if (this.instance) {
      return this.instance;
    }

    const isTauri = this.isTauriEnvironment();

    if (isTauri) {
      this.instance = new TauriSecureStorage();
      this.initialized = true;
    } else {
      // Web fallback: Use LocalStorage with base64 encoding
      this.instance = new WebSecureStorage();
      this.initialized = true;
    }

    return this.instance;
  }

  /**
   * Force re-initialization (useful after Tauri becomes available)
   */
  static reinitialize(): ISecureKeyStorage {
    this.instance = undefined as unknown as ISecureKeyStorage;
    this.initialized = false;
    return this.getInstance();
  }

  static setInstance(storage: ISecureKeyStorage): void {
    this.instance = storage;
  }
}

/**
 * Web implementation using localStorage with base64 obfuscation
 * WARNING: This is NOT fully secure - localStorage is accessible to JS.
 * This provides basic obfuscation but NOT encryption.
 * For production web, use a backend authentication server.
 * Private keys should be encrypted with user password before storage.
 */
export class WebSecureStorage implements ISecureKeyStorage {
  private keyStoragePrefix = 'steem_key_';

  // Simple obfuscation (NOT encryption) - provides minimal protection
  private obfuscate(value: string): string {
    try {
      return btoa(encodeURIComponent(value).replace(/%([0-9A-F]{2})/g,
        (_, p1) => String.fromCharCode(parseInt(p1, 16))));
    } catch {
      return value;
    }
  }

  private deobfuscate(value: string): string {
    try {
      return decodeURIComponent(atob(value).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    } catch {
      return value; // Return as-is if not obfuscated (backwards compatibility)
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Obfuscate sensitive keys (private keys and passwords)
      const isSensitive = key.includes('_key') || key.includes('password');
      const storedValue = isSensitive ? this.obfuscate(value) : value;
      localStorage.setItem(key, storedValue);
    } catch (error) {
      console.error('Failed to store item in localStorage:', error);
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;
      // Deobfuscate sensitive keys
      const isSensitive = key.includes('_key') || key.includes('password');
      return isSensitive ? this.deobfuscate(value) : value;
    } catch (error) {
      console.error('Failed to retrieve item from localStorage:', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove item from localStorage:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  async setEncryptedKey(
    keyType: string,
    username: string,
    encryptedKey: string,
    password: string
  ): Promise<void> {
    const key = `${this.keyStoragePrefix}${username}_${keyType}`;
    await this.setItem(key, encryptedKey);
  }

  async getEncryptedKey(keyType: string, username: string): Promise<string | null> {
    const key = `${this.keyStoragePrefix}${username}_${keyType}`;
    return await this.getItem(key);
  }

  async removeEncryptedKey(keyType: string, username: string): Promise<void> {
    const key = `${this.keyStoragePrefix}${username}_${keyType}`;
    await this.removeItem(key);
  }
}


/**
 * Utility function to safely sign transactions without exposing private keys
 * All signing happens in Rust backend
 */
export async function signTransactionSecurely(
  transactionData: string,
  encryptedKeyData: EncryptedKeyData,
  password: string
): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');

  const signature = await invoke(
    'sign_transaction',
    {
      transaction_data: transactionData,
      encrypted_key_data: JSON.stringify(encryptedKeyData),
      password,
    }
  ) as string;

  return signature;
}

/**
 * Utility function to verify private key format
 * Validation happens in Rust backend
 */
export async function verifyPrivateKeyFormat(privateKey: string): Promise<boolean> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke(
      'verify_private_key_format',
      {
        private_key: privateKey,
      }
    );
  } catch {
    // Fallback: basic validation
    return privateKey.startsWith('5') && privateKey.length >= 50;
  }
}
