/**
 * Account Manager Service
 * Handles multiple account storage and switching
 */

import { SecureStorageFactory } from './secureStorage';

export interface StoredAccount {
  username: string;
  loginMethod: 'privatekey' | 'masterpassword';
  addedAt: number;
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
   */
  async addAccount(credentials: AccountCredentials): Promise<void> {
    const storage = SecureStorageFactory.getInstance();
    const accounts = await this.getAccounts();
    
    // Check if account already exists
    const existingIndex = accounts.findIndex(a => a.username === credentials.username);
    
    const accountInfo: StoredAccount = {
      username: credentials.username,
      loginMethod: credentials.loginMethod,
      addedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      accounts[existingIndex] = accountInfo;
    } else {
      accounts.push(accountInfo);
    }

    // Save accounts list
    await storage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(accounts));

    // Save account-specific credentials with username prefix
    const prefix = `account_${credentials.username}_`;
    
    await storage.setItem(`${prefix}login_method`, credentials.loginMethod);
    
    if (credentials.ownerKey) {
      await storage.setItem(`${prefix}owner_key`, credentials.ownerKey);
    }
    if (credentials.activeKey) {
      await storage.setItem(`${prefix}active_key`, credentials.activeKey);
    }
    if (credentials.postingKey) {
      await storage.setItem(`${prefix}posting_key`, credentials.postingKey);
    }
    if (credentials.memoKey) {
      await storage.setItem(`${prefix}memo_key`, credentials.memoKey);
    }
    if (credentials.masterPassword) {
      await storage.setItem(`${prefix}master_password`, credentials.masterPassword);
    }
    if (credentials.importedKeyType) {
      await storage.setItem(`${prefix}imported_key_type`, credentials.importedKeyType);
    }

    // Set as active account
    await this.setActiveAccount(credentials.username);

    // Also update the legacy keys for backward compatibility
    await this.loadAccountCredentials(credentials.username);
  }

  /**
   * Load account credentials into the main storage slots (for backward compatibility)
   */
  async loadAccountCredentials(username: string): Promise<AccountCredentials | null> {
    const storage = SecureStorageFactory.getInstance();
    const prefix = `account_${username}_`;
    
    const loginMethod = await storage.getItem(`${prefix}login_method`) as 'privatekey' | 'masterpassword' | null;
    if (!loginMethod) return null;

    const credentials: AccountCredentials = {
      username,
      loginMethod,
    };

    // Load all keys
    const ownerKey = await storage.getItem(`${prefix}owner_key`);
    const activeKey = await storage.getItem(`${prefix}active_key`);
    const postingKey = await storage.getItem(`${prefix}posting_key`);
    const memoKey = await storage.getItem(`${prefix}memo_key`);
    const masterPassword = await storage.getItem(`${prefix}master_password`);
    const importedKeyType = await storage.getItem(`${prefix}imported_key_type`);

    if (ownerKey) credentials.ownerKey = ownerKey;
    if (activeKey) credentials.activeKey = activeKey;
    if (postingKey) credentials.postingKey = postingKey;
    if (memoKey) credentials.memoKey = memoKey;
    if (masterPassword) credentials.masterPassword = masterPassword;
    if (importedKeyType) credentials.importedKeyType = importedKeyType;

    // Update legacy storage slots for the active account
    await storage.setItem('steem_username', username);
    await storage.setItem('steem_login_method', loginMethod);
    
    if (ownerKey) await storage.setItem('steem_owner_key', ownerKey);
    else await storage.removeItem('steem_owner_key');
    
    if (activeKey) await storage.setItem('steem_active_key', activeKey);
    else await storage.removeItem('steem_active_key');
    
    if (postingKey) await storage.setItem('steem_posting_key', postingKey);
    else await storage.removeItem('steem_posting_key');
    
    if (memoKey) await storage.setItem('steem_memo_key', memoKey);
    else await storage.removeItem('steem_memo_key');
    
    if (masterPassword) await storage.setItem('steem_master_password', masterPassword);
    else await storage.removeItem('steem_master_password');
    
    if (importedKeyType) await storage.setItem('steem_imported_key_type', importedKeyType);
    else await storage.removeItem('steem_imported_key_type');

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
   * Remove an account
   */
  async removeAccount(username: string): Promise<void> {
    const storage = SecureStorageFactory.getInstance();
    const accounts = await this.getAccounts();
    
    // Remove from accounts list
    const filteredAccounts = accounts.filter(a => a.username !== username);
    await storage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(filteredAccounts));

    // Remove account-specific credentials
    const prefix = `account_${username}_`;
    await storage.removeItem(`${prefix}login_method`);
    await storage.removeItem(`${prefix}owner_key`);
    await storage.removeItem(`${prefix}active_key`);
    await storage.removeItem(`${prefix}posting_key`);
    await storage.removeItem(`${prefix}memo_key`);
    await storage.removeItem(`${prefix}master_password`);
    await storage.removeItem(`${prefix}imported_key_type`);

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
        await storage.removeItem('steem_owner_key');
        await storage.removeItem('steem_active_key');
        await storage.removeItem('steem_posting_key');
        await storage.removeItem('steem_memo_key');
        await storage.removeItem('steem_master_password');
        await storage.removeItem('steem_imported_key_type');
      }
    }
  }

  /**
   * Clear all accounts
   */
  async clearAllAccounts(): Promise<void> {
    const storage = SecureStorageFactory.getInstance();
    const accounts = await this.getAccounts();
    
    // Remove all account-specific data
    for (const account of accounts) {
      const prefix = `account_${account.username}_`;
      await storage.removeItem(`${prefix}login_method`);
      await storage.removeItem(`${prefix}owner_key`);
      await storage.removeItem(`${prefix}active_key`);
      await storage.removeItem(`${prefix}posting_key`);
      await storage.removeItem(`${prefix}memo_key`);
      await storage.removeItem(`${prefix}master_password`);
      await storage.removeItem(`${prefix}imported_key_type`);
    }

    await storage.removeItem(ACCOUNTS_LIST_KEY);
    await storage.removeItem(ACTIVE_ACCOUNT_KEY);
  }
}

export const accountManager = AccountManagerService.getInstance();
