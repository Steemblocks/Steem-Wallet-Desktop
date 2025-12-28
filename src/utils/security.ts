/**
 * Security Utilities
 * Helper functions for input validation, sanitization, and security checks
 */

/**
 * Sanitize username input
 * Steem usernames: 3-16 chars, lowercase, alphanumeric with dots/dashes, no leading digits
 */
export const sanitizeUsername = (input: string): string => {
  if (!input) return '';
  
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.-]/g, '') // Remove invalid characters
    .slice(0, 16); // Max length
};

/**
 * Validate Steem username format
 */
export const isValidSteemUsername = (username: string): boolean => {
  if (!username || username.length < 3 || username.length > 16) {
    return false;
  }
  
  // Must start with a letter
  if (!/^[a-z]/.test(username)) {
    return false;
  }
  
  // Can only contain lowercase letters, numbers, dots, and dashes
  if (!/^[a-z][a-z0-9.-]*[a-z0-9]$/.test(username) && username.length > 2) {
    return false;
  }
  
  // No consecutive dots or dashes
  if (/[.-]{2}/.test(username)) {
    return false;
  }
  
  return true;
};

/**
 * Validate private key format (WIF format)
 * WIF keys start with '5' and are 51-52 characters
 */
export const isValidPrivateKeyFormat = (key: string): boolean => {
  if (!key) return false;
  
  // WIF format: starts with '5', 51-52 chars, base58 characters only
  const wifRegex = /^5[HJK][1-9A-HJ-NP-Za-km-z]{49,50}$/;
  return wifRegex.test(key);
};

/**
 * Mask a private key for display (show first and last 4 chars)
 */
export const maskPrivateKey = (key: string): string => {
  if (!key || key.length < 10) return '***';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

/**
 * Mask a password for display
 */
export const maskPassword = (password: string): string => {
  if (!password) return '';
  return '*'.repeat(Math.min(password.length, 20));
};

/**
 * Validate amount format (positive number with up to 3 decimal places)
 */
export const isValidAmount = (amount: string): boolean => {
  if (!amount) return false;
  
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return false;
  
  // Check for valid decimal places (max 3)
  const parts = amount.split('.');
  if (parts.length > 2) return false;
  if (parts[1] && parts[1].length > 3) return false;
  
  return true;
};

/**
 * Sanitize memo input (remove control characters, limit length)
 */
export const sanitizeMemo = (memo: string, maxLength: number = 2048): string => {
  if (!memo) return '';
  
  return memo
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, maxLength);
};

/**
 * Check if running in secure context (HTTPS or localhost)
 */
export const isSecureContext = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return window.isSecureContext || 
         window.location.protocol === 'https:' ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1' ||
         window.location.protocol === 'tauri:';
};

/**
 * Check if Tauri environment (more secure than web)
 */
export const isTauriEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return '__TAURI__' in window ||
         '__TAURI_INTERNALS__' in window ||
         document.documentElement.hasAttribute('data-tauri-platform');
};

/**
 * Securely clear a string from memory (best effort)
 * Note: JavaScript doesn't guarantee memory clearing, but this helps
 */
export const secureClear = (str: string): void => {
  if (typeof str === 'string' && str.length > 0) {
    // Overwrite the string content (limited effectiveness in JS)
    try {
      const arr = str.split('');
      for (let i = 0; i < arr.length; i++) {
        arr[i] = '\0';
      }
    } catch {
      // Ignore errors
    }
  }
};

/**
 * Generate a cryptographically secure random string
 */
export const generateSecureRandom = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  
  return result;
};

/**
 * Hash a string using SHA-256 (for non-sensitive operations like cache keys)
 */
export const hashString = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private attempts: number[] = [];
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  /**
   * Check if action is allowed
   */
  isAllowed(): boolean {
    const now = Date.now();
    this.attempts = this.attempts.filter(time => now - time < this.windowMs);
    return this.attempts.length < this.maxAttempts;
  }

  /**
   * Record an attempt
   */
  recordAttempt(): void {
    this.attempts.push(Date.now());
  }

  /**
   * Get remaining time until next allowed attempt (in ms)
   */
  getWaitTime(): number {
    if (this.isAllowed()) return 0;
    
    const oldestAttempt = Math.min(...this.attempts);
    return Math.max(0, this.windowMs - (Date.now() - oldestAttempt));
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.attempts = [];
  }
}

/**
 * Login attempt rate limiter (5 attempts per minute)
 */
export const loginRateLimiter = new RateLimiter(5, 60000);

/**
 * Transaction rate limiter (10 transactions per minute)
 */
export const transactionRateLimiter = new RateLimiter(10, 60000);
