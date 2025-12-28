/**
 * App Lock Service
 * Manages the one-time app lock password for securing the wallet
 * This is separate from Steem keys - it's a local app security layer
 */

import { SecureStorageFactory } from './secureStorage';

// Storage keys
const APP_LOCK_HASH_KEY = 'app_lock_password_hash';
const APP_LOCK_SALT_KEY = 'app_lock_salt';
const APP_LOCK_SETUP_KEY = 'app_lock_setup_complete';

/**
 * Simple hash function for the app lock password
 * Uses Web Crypto API for secure hashing
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Validate password strength
 * Must have: 8+ chars, uppercase, lowercase, digit, special char
 */
function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one digit' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }
  return { valid: true };
}

/**
 * Generate a random salt for password hashing
 */
function generateSalt(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class AppLockService {
  private static instance: AppLockService;
  private storage = SecureStorageFactory.getInstance();

  private constructor() {}

  static getInstance(): AppLockService {
    if (!AppLockService.instance) {
      AppLockService.instance = new AppLockService();
    }
    return AppLockService.instance;
  }

  /**
   * Check if the app lock password has been set up
   */
  async isSetupComplete(): Promise<boolean> {
    try {
      const setupComplete = await this.storage.getItem(APP_LOCK_SETUP_KEY);
      return setupComplete === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Set up the app lock password (one-time setup)
   */
  async setupPassword(password: string): Promise<boolean> {
    try {
      // Validate password strength
      const validation = validatePasswordStrength(password);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid password');
      }

      const salt = generateSalt();
      const hash = await hashPassword(password, salt);

      await this.storage.setItem(APP_LOCK_SALT_KEY, salt);
      await this.storage.setItem(APP_LOCK_HASH_KEY, hash);
      await this.storage.setItem(APP_LOCK_SETUP_KEY, 'true');

      return true;
    } catch (error) {
      console.error('Error setting up app lock password:', error);
      return false;
    }
  }

  /**
   * Verify the app lock password
   */
  async verifyPassword(password: string): Promise<boolean> {
    try {
      const salt = await this.storage.getItem(APP_LOCK_SALT_KEY);
      const storedHash = await this.storage.getItem(APP_LOCK_HASH_KEY);

      if (!salt || !storedHash) {
        return false;
      }

      const inputHash = await hashPassword(password, salt);
      return inputHash === storedHash;
    } catch (error) {
      console.error('Error verifying app lock password:', error);
      return false;
    }
  }

  /**
   * Change the app lock password (requires current password)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const isValid = await this.verifyPassword(currentPassword);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password strength
      const validation = validatePasswordStrength(newPassword);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid password');
      }

      const salt = generateSalt();
      const hash = await hashPassword(newPassword, salt);

      await this.storage.setItem(APP_LOCK_SALT_KEY, salt);
      await this.storage.setItem(APP_LOCK_HASH_KEY, hash);

      return true;
    } catch (error) {
      console.error('Error changing app lock password:', error);
      return false;
    }
  }

  /**
   * Reset the entire app (clear all data including credentials)
   * Use this when user forgets their app lock password
   */
  async resetApp(): Promise<boolean> {
    try {
      await this.storage.clear();
      return true;
    } catch (error) {
      console.error('Error resetting app:', error);
      return false;
    }
  }

  /**
   * Remove only the app lock (keeps Steem credentials)
   * Requires password verification first
   */
  async removeAppLock(password: string): Promise<boolean> {
    try {
      const isValid = await this.verifyPassword(password);
      if (!isValid) {
        throw new Error('Password is incorrect');
      }

      await this.storage.removeItem(APP_LOCK_HASH_KEY);
      await this.storage.removeItem(APP_LOCK_SALT_KEY);
      await this.storage.removeItem(APP_LOCK_SETUP_KEY);

      return true;
    } catch (error) {
      console.error('Error removing app lock:', error);
      return false;
    }
  }
}

export default AppLockService;
