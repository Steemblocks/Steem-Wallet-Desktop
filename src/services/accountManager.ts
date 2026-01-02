/**
 * Account Manager Service
 * Handles multiple account storage and switching
 * 
 * Security: All private keys are encrypted with the app lock password
 * using AES-256-GCM encryption before being stored.
 */

import { SecureStorageFactory } from './secureStorage';
import { encryptedKeyStorage } from './encryptedKeyStorage';

export interface StoredAccount {
  username: string;
  loginMethod: 'privatekey' | 'masterpassword';
  addedAt: number;
  hasEncryptedKeys?: boolean;
}

export interface AccountCredentials {
  username: string;
  loginMethod: 'privatekey' | 'masterpassword';
  ownerKey?: string;
  activeKey?: string;
  postingKey?: string;
  memoKey?: string;
  masterPassword?: string;
  importedKeyType?: string;
}

const ACCOUNTS_LIST_KEY = 'steem_accounts_list';
const ACTIVE_ACCOUNT_KEY = 'steem_active_account';

class AccountManagerService {
  private static instance: AccountManagerService;
  private migrationChecked: boolean = false;

  static getInstance(): AccountManagerService {
    if (!AccountManagerService.instance) {
      AccountManagerService.instance = new AccountManagerService();
    }
    return AccountManagerService.instance;
  }

  /**
   * Cache the app lock password for key operations
   */
  cachePassword(password: string): void {
    encryptedKeyStorage.cachePassword(password);
  }

  /**
   * Clear the cached password
   */
  clearPasswordCache(): void {
    encryptedKeyStorage.clearPasswordCache();
  }

  /**
   * Migrate legacy account (stored before multi-account support) to new format
   */
  private async migrateLegacyAccount(): Promise<void> {
    if (this.migrationChecked) return;
    this.migrationChecked = true;

    const storage = SecureStorageFactory.getInstance();
    
    // Check if there's a legacy account that's not in the accounts list
    const legacyUsername = await storage.getItem('steem_username');
    if (!legacyUsername) return;

    // Check if accounts list exists
    const accountsJson = await storage.getItem(ACCOUNTS_LIST_KEY);
    let accounts: StoredAccount[] = [];
    
    try {
      if (accountsJson) {
        accounts = JSON.parse(accountsJson);
      }
    } catch {
      accounts = [];
    }

    // Check if legacy account is already in the list
    const alreadyMigrated = accounts.some(a => a.username === legacyUsername);
    if (alreadyMigrated) return;

    // Migrate the legacy account
    const loginMethod = await storage.getItem('steem_login_method') as 'privatekey' | 'masterpassword' | null;
    if (!loginMethod) return;

    // Copy legacy keys to account-specific storage
    const prefix = `account_${legacyUsername}_`;
    await storage.setItem(`${prefix}login_method`, loginMethod);

    const ownerKey = await storage.getItem('steem_owner_key');
    const activeKey = await storage.getItem('steem_active_key');
    const postingKey = await storage.getItem('steem_posting_key');
    const memoKey = await storage.getItem('steem_memo_key');
    const masterPassword = await storage.getItem('steem_master_password');
    const importedKeyType = await storage.getItem('steem_imported_key_type');

    if (ownerKey) await storage.setItem(`${prefix}owner_key`, ownerKey);
    if (activeKey) await storage.setItem(`${prefix}active_key`, activeKey);
    if (postingKey) await storage.setItem(`${prefix}posting_key`, postingKey);
    if (memoKey) await storage.setItem(`${prefix}memo_key`, memoKey);
    if (masterPassword) await storage.setItem(`${prefix}master_password`, masterPassword);
    if (importedKeyType) await storage.setItem(`${prefix}imported_key_type`, importedKeyType);

    // Add to accounts list
    const accountInfo: StoredAccount = {
      username: legacyUsername,
      loginMethod,
      addedAt: Date.now(),
    };
    accounts.push(accountInfo);
    await storage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(accounts));

    // Set as active account
    await storage.setItem(ACTIVE_ACCOUNT_KEY, legacyUsername);

    console.log(`Migrated legacy account @${legacyUsername} to new multi-account format`);
  }

  /**
   * Get list of all stored accounts
   */
  async getAccounts(): Promise<StoredAccount[]> {
    const storage = SecureStorageFactory.getInstance();
    
    // Ensure legacy account is migrated first
    await this.migrateLegacyAccount();
    
    const accountsJson = await storage.getItem(ACCOUNTS_LIST_KEY);
    if (!accountsJson) return [];
    try {
      return JSON.parse(accountsJson);
    } catch {
      return [];
    }
  }

  /**
   * Get currently active account
   */
  async getActiveAccount(): Promise<string | null> {
    const storage = SecureStorageFactory.getInstance();
    return await storage.getItem(ACTIVE_ACCOUNT_KEY);
  }

  /**
   * Set the active account
   */
  async setActiveAccount(username: string): Promise<void> {
    const storage = SecureStorageFactory.getInstance();
    await storage.setItem(ACTIVE_ACCOUNT_KEY, username);
  }

  /**
   * Add a new account or update existing one
   * Keys are encrypted with the app lock password before storage
   */
  async addAccount(credentials: AccountCredentials, appLockPassword?: string): Promise<void> {
    const storage = SecureStorageFactory.getInstance();
    const accounts = await this.getAccounts();
    
    // Check if account already exists
    const existingIndex = accounts.findIndex(a => a.username === credentials.username);
    
    const accountInfo: StoredAccount = {
      username: credentials.username,
      loginMethod: credentials.loginMethod,
      addedAt: Date.now(),
      hasEncryptedKeys: true,
    };

    if (existingIndex >= 0) {
      accounts[existingIndex] = accountInfo;
    } else {
      accounts.push(accountInfo);
    }

    // Save accounts list
    await storage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(accounts));

    // Save account-specific metadata (non-sensitive)
    const prefix = `account_${credentials.username}_`;
    await storage.setItem(`${prefix}login_method`, credentials.loginMethod);
    
    if (credentials.importedKeyType) {
      await storage.setItem(`${prefix}imported_key_type`, credentials.importedKeyType);
    }

    // Store keys encrypted (sensitive data)
    // Use provided password or cached password
    if (credentials.ownerKey) {
      await encryptedKeyStorage.storeEncryptedKey('owner', credentials.username, credentials.ownerKey, appLockPassword);
    }
    if (credentials.activeKey) {
      await encryptedKeyStorage.storeEncryptedKey('active', credentials.username, credentials.activeKey, appLockPassword);
    }
    if (credentials.postingKey) {
      await encryptedKeyStorage.storeEncryptedKey('posting', credentials.username, credentials.postingKey, appLockPassword);
    }
    if (credentials.memoKey) {
      await encryptedKeyStorage.storeEncryptedKey('memo', credentials.username, credentials.memoKey, appLockPassword);
    }
    if (credentials.masterPassword) {
      await encryptedKeyStorage.storeEncryptedKey('master', credentials.username, credentials.masterPassword, appLockPassword);
    }

    // Set as active account
    await this.setActiveAccount(credentials.username);

    // Update username in storage for backward compatibility
    await storage.setItem('steem_username', credentials.username);
    await storage.setItem('steem_login_method', credentials.loginMethod);
  }

  /**
   * Get a decrypted key for an account
   * Used when signing transactions
   */
  async getDecryptedKey(
    username: string,
    keyType: 'owner' | 'active' | 'posting' | 'memo' | 'master',
    appLockPassword?: string
  ): Promise<string | null> {
    return await encryptedKeyStorage.getDecryptedKey(keyType, username, appLockPassword);
  }

  /**
   * Check if a key exists for an account (without decrypting)
   */
  async hasKey(username: string, keyType: 'owner' | 'active' | 'posting' | 'memo' | 'master'): Promise<boolean> {
    return await encryptedKeyStorage.hasKey(keyType, username);
  }

  /**
   * Load account credentials (decrypts keys on-demand)
   * Note: Keys are NOT loaded into memory by default for security
   * Use getDecryptedKey() when you need a specific key
   */
  async loadAccountCredentials(username: string, appLockPassword?: string): Promise<AccountCredentials | null> {
    const storage = SecureStorageFactory.getInstance();
    const prefix = `account_${username}_`;
    
    const loginMethod = await storage.getItem(`${prefix}login_method`) as 'privatekey' | 'masterpassword' | null;
    if (!loginMethod) return null;

    const credentials: AccountCredentials = {
      username,
      loginMethod,
    };

    const importedKeyType = await storage.getItem(`${prefix}imported_key_type`);
    if (importedKeyType) credentials.importedKeyType = importedKeyType;

    // Only load keys if password is provided (for backward compatibility)
    if (appLockPassword) {
      try {
        const ownerKey = await encryptedKeyStorage.getDecryptedKey('owner', username, appLockPassword);
        const activeKey = await encryptedKeyStorage.getDecryptedKey('active', username, appLockPassword);
        const postingKey = await encryptedKeyStorage.getDecryptedKey('posting', username, appLockPassword);
        const memoKey = await encryptedKeyStorage.getDecryptedKey('memo', username, appLockPassword);
        const masterPassword = await encryptedKeyStorage.getDecryptedKey('master', username, appLockPassword);

        if (ownerKey) credentials.ownerKey = ownerKey;
        if (activeKey) credentials.activeKey = activeKey;
        if (postingKey) credentials.postingKey = postingKey;
        if (memoKey) credentials.memoKey = memoKey;
        if (masterPassword) credentials.masterPassword = masterPassword;
      } catch (error) {
        console.error('Failed to decrypt keys:', error);
        // Keys couldn't be decrypted, return credentials without keys
      }
    }

    // Update username in storage for backward compatibility
    await storage.setItem('steem_username', username);
    await storage.setItem('steem_login_method', loginMethod);

    return credentials;
  }

  /**
   * Switch to a different account
   */
  async switchAccount(username: string): Promise<AccountCredentials | null> {
    const accounts = await this.getAccounts();
    const account = accounts.find(a => a.username === username);
    
    if (!account) return null;

    await this.setActiveAccount(username);
    return await this.loadAccountCredentials(username);
  }

  /**
   * Remove an account and all its encrypted keys
   */
  async removeAccount(username: string): Promise<void> {
    const storage = SecureStorageFactory.getInstance();
    const accounts = await this.getAccounts();
    
    // Remove from accounts list
    const filteredAccounts = accounts.filter(a => a.username !== username);
    await storage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(filteredAccounts));

    // Remove account-specific metadata
    const prefix = `account_${username}_`;
    await storage.removeItem(`${prefix}login_method`);
    await storage.removeItem(`${prefix}imported_key_type`);

    // Remove encrypted keys
    await encryptedKeyStorage.removeKey('owner', username);
    await encryptedKeyStorage.removeKey('active', username);
    await encryptedKeyStorage.removeKey('posting', username);
    await encryptedKeyStorage.removeKey('memo', username);
    await encryptedKeyStorage.removeKey('master', username);

    // If this was the active account, switch to another or clear
    const activeAccount = await this.getActiveAccount();
    if (activeAccount === username) {
      if (filteredAccounts.length > 0) {
        await this.switchAccount(filteredAccounts[0].username);
      } else {
        await storage.removeItem(ACTIVE_ACCOUNT_KEY);
        // Clear legacy storage
        await storage.removeItem('steem_username');
        await storage.removeItem('steem_login_method');
      }
    }
  }

  /**
   * Clear all accounts and their encrypted keys
   */
  async clearAllAccounts(): Promise<void> {
    const storage = SecureStorageFactory.getInstance();
    const accounts = await this.getAccounts();
    
    // Remove all account-specific data and encrypted keys
    for (const account of accounts) {
      const prefix = `account_${account.username}_`;
      await storage.removeItem(`${prefix}login_method`);
      await storage.removeItem(`${prefix}imported_key_type`);
      
      // Remove encrypted keys
      await encryptedKeyStorage.removeKey('owner', account.username);
      await encryptedKeyStorage.removeKey('active', account.username);
      await encryptedKeyStorage.removeKey('posting', account.username);
      await encryptedKeyStorage.removeKey('memo', account.username);
      await encryptedKeyStorage.removeKey('master', account.username);
    }

    await storage.removeItem(ACCOUNTS_LIST_KEY);
    await storage.removeItem(ACTIVE_ACCOUNT_KEY);
    await storage.removeItem('steem_username');
    await storage.removeItem('steem_login_method');
  }

  /**
   * Re-encrypt all keys with a new password
   * Called when changing the app lock password
   */
  async reEncryptAllKeys(oldPassword: string, newPassword: string): Promise<void> {
    const accounts = await this.getAccounts();
    const usernames = accounts.map(a => a.username);
    await encryptedKeyStorage.reEncryptAllKeys(oldPassword, newPassword, usernames);
  }

  /**
   * Migrate existing unencrypted keys to encrypted storage
   * Called when app lock is first set up
   */
  async migrateToEncryptedStorage(appLockPassword: string): Promise<void> {
    const accounts = await this.getAccounts();
    const usernames = accounts.map(a => a.username);
    await encryptedKeyStorage.migrateToEncrypted(appLockPassword, usernames);
  }
}

export const accountManager = AccountManagerService.getInstance();
