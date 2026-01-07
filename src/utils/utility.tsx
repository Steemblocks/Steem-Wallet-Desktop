
// src/utils/Utility.tsx
import { steemApi } from '@/services/steemApi';

// Define the structure of the dynamic global properties we need
interface DynamicGlobalProperties {
  total_vesting_fund_steem: string;
  total_vesting_shares: string;
}

// ===== Caching for getSteemPerMvests to reduce redundant API calls =====
// This value changes very slowly (once per 3 seconds at block level), 
// so caching for 60 seconds is safe and reduces API calls significantly
interface SteemPerMvestsCache {
  value: number;
  timestamp: number;
}

let steemPerMvestsCache: SteemPerMvestsCache | null = null;
const STEEM_PER_MVESTS_CACHE_TTL = 60000; // 60 seconds cache

/**
 * Fetches the current Steem per MegaVests (1,000,000 Vests) value.
 * Results are cached for 60 seconds to reduce API calls.
 *
 * @param forceRefresh If true, bypasses the cache and fetches fresh data
 * @returns {Promise<number>} A promise that resolves to the current Steem per Mvests value.
 */
export const getSteemPerMvests = async (forceRefresh = false): Promise<number> => {
  const now = Date.now();
  
  // Return cached value if still valid and not forcing refresh
  if (!forceRefresh && steemPerMvestsCache && (now - steemPerMvestsCache.timestamp) < STEEM_PER_MVESTS_CACHE_TTL) {
    return steemPerMvestsCache.value;
  }
  
  try {
    const properties = await steemApi.getDynamicGlobalProperties();
    const totalVestingFundSteem = parseFloat(properties.total_vesting_fund_steem.split(' ')[0]);
    const totalVestingShares = parseFloat(properties.total_vesting_shares.split(' ')[0]);

    if (totalVestingShares === 0) {
      return 0;
    }

    const steemPerVest = totalVestingFundSteem / totalVestingShares;
    const result = steemPerVest * 1_000_000; // Steem per MegaVests
    
    // Cache the result
    steemPerMvestsCache = { value: result, timestamp: now };
    
    return result;
  } catch (error) {
    console.error('Error fetching Steem per Mvests:', error);
    
    // If we have a cached value (even if stale), return it as fallback
    if (steemPerMvestsCache) {
      console.log('Using stale cached Steem per Mvests value as fallback');
      return steemPerMvestsCache.value;
    }
    
    throw new Error('Could not fetch Steem per Mvests. Please check the API endpoint and your network connection.');
  }
};

/**
 * Update the cached Steem per Mvests value from external source (e.g., WebSocket)
 * This allows other parts of the app to update the cache without making API calls
 */
export const updateSteemPerMvestsCache = (value: number): void => {
  steemPerMvestsCache = { value, timestamp: Date.now() };
};

/**
 * Converts Vests to Steem.
 *
 * @param {number} vests The amount of Vests to convert.
 * @param {number} steemPerMvests The current Steem per Mvests value.
 * @returns {number} The equivalent amount of Steem.
 */
export const vestsToSteem = (vests: number, steemPerMvests: number): number => {
  if (steemPerMvests === 0) {
    return 0;
  }
  return (vests / 1_000_000) * steemPerMvests;
};

/**
 * Calculates days until next withdrawal
 *
 * @param {string} nextWithdrawalDate The next withdrawal date string
 * @returns {number} Days until next withdrawal
 */
export const getDaysUntilNextWithdrawal = (nextWithdrawalDate: string): number => {
  const nextDate = new Date(nextWithdrawalDate);
  const now = new Date();
  const diffTime = nextDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Opens a URL in the system's default browser using Tauri's opener plugin.
 * Falls back to window.open for non-Tauri environments.
 *
 * @param {string} url The URL to open
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  try {
    // Check if running in Tauri environment
    if (window.__TAURI_INTERNALS__) {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } else {
      // Fallback for browser/dev environment
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (error) {
    console.error('Error opening URL:', error);
    // Fallback to window.open if Tauri API fails
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Default avatar as a data URI (simple user silhouette)
 * This is used when external avatar services fail
 */
export const DEFAULT_AVATAR_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzY0NzQ4YiI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';

/**
 * Get avatar URL for a Steem username
 * @param username The Steem username
 * @param size Optional size ('small' for smaller image)
 * @returns The avatar URL
 */
export const getAvatarUrl = (username: string, size?: 'small'): string => {
  if (!username) return DEFAULT_AVATAR_DATA_URI;
  const sizeSuffix = size ? `/${size}` : '';
  return `https://steemitimages.com/u/${username}/avatar${sizeSuffix}`;
};

/**
 * Handle avatar image error by setting a fallback
 * Use this as the onError handler for avatar img elements
 * @param event The error event
 */
export const handleAvatarError = (event: React.SyntheticEvent<HTMLImageElement>): void => {
  const img = event.target as HTMLImageElement;
  // Prevent infinite loop by checking if we're already using the fallback
  if (img.src !== DEFAULT_AVATAR_DATA_URI) {
    img.src = DEFAULT_AVATAR_DATA_URI;
  }
};
