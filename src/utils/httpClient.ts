/**
 * HTTP Client utility that uses Tauri's HTTP client when running in Tauri
 * to bypass CORS restrictions, and falls back to browser fetch otherwise.
 * In development mode (browser), uses Vite's proxy to avoid CORS.
 */

import { getPrimaryEndpoint } from '@/config/api';

interface HttpPostResponse {
  success: boolean;
  status: number;
  body: string | null;
  error: string | null;
  latency_ms: number;
}

// Check if running in Tauri - check multiple ways to be sure
export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Check for __TAURI__ global
  if ('__TAURI__' in window) return true;
  // Check for __TAURI_INTERNALS__ (Tauri v2)
  if ('__TAURI_INTERNALS__' in window) return true;
  return false;
};

// Check if running in development mode
const isDevelopment = (): boolean => {
  return import.meta.env.DEV;
};

// Mapping from endpoint URLs to proxy keys
const ENDPOINT_TO_PROXY_KEY: Record<string, string> = {
  'https://api.moecki.online': 'moecki',
  'https://steemd.steemworld.org': 'steemworld',
  'https://api.pennsif.net': 'pennsif',
  'https://api.steemit.com': 'steemit',
  'https://api.justyy.com': 'justyy',
  'https://api.wherein.io': 'wherein',
  'https://api.steememory.com': 'steememory',
  'https://steemapi.boylikegirl.club': 'boylikegirl',
  'https://api.steemitdev.com': 'steemitdev',
};

// Get proxy key for a given endpoint URL
const getProxyKey = (url: string): string | null => {
  for (const [endpoint, key] of Object.entries(ENDPOINT_TO_PROXY_KEY)) {
    if (url.startsWith(endpoint)) {
      return key;
    }
  }
  return null;
};

// Convert Steem API URL to use dev proxy based on user's selected node
const getProxiedUrl = (url: string): string => {
  if (!isDevelopment() || isTauri()) {
    return url;
  }
  
  // Get the proxy key for this endpoint
  const proxyKey = getProxyKey(url);
  if (proxyKey) {
    return `/api/steem/${proxyKey}`;
  }
  
  // For unknown endpoints, try to use the user's selected node proxy
  const primaryEndpoint = getPrimaryEndpoint();
  const primaryProxyKey = getProxyKey(primaryEndpoint);
  if (primaryProxyKey) {
    return `/api/steem/${primaryProxyKey}`;
  }
  
  // Fallback to moecki if nothing else works
  return '/api/steem/moecki';
};

// Cache the Tauri invoke function
let cachedInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

const getTauriInvoke = async () => {
  if (cachedInvoke) return cachedInvoke;
  
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    cachedInvoke = invoke;
    return invoke;
  }
  return null;
};

/**
 * Make an HTTP POST request that bypasses CORS when running in Tauri
 */
export const httpPost = async (
  url: string,
  body: string,
  timeoutMs: number = 10000
): Promise<{ ok: boolean; data: any; error?: string; latencyMs?: number }> => {
  const invoke = await getTauriInvoke();
  
  if (invoke) {
    // Use Tauri's HTTP client (bypasses CORS)
    try {
      const result = await invoke('http_post', { url, body }) as HttpPostResponse;
      
      if (result.success && result.body) {
        try {
          const data = JSON.parse(result.body);
          return { ok: true, data, latencyMs: result.latency_ms };
        } catch {
          return { ok: false, data: null, error: 'Failed to parse response' };
        }
      }
      
      return { 
        ok: false, 
        data: null, 
        error: result.error || 'Request failed',
        latencyMs: result.latency_ms 
      };
    } catch (error) {
      return { 
        ok: false, 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  // Fallback to browser fetch (use proxy in dev mode to avoid CORS)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();
    
    // Use proxied URL in development mode
    const fetchUrl = getProxiedUrl(url);
    
    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    
    if (!response.ok) {
      return { 
        ok: false, 
        data: null, 
        error: `HTTP error! status: ${response.status}`,
        latencyMs 
      };
    }
    
    const data = await response.json();
    return { ok: true, data, latencyMs };
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return { 
        ok: false, 
        data: null, 
        error: 'CORS or network error - request blocked' 
      };
    }
    return { 
      ok: false, 
      data: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

/**
 * Make a JSON-RPC request to a Steem API endpoint
 */
export const jsonRpcRequest = async (
  endpoint: string,
  method: string,
  params: any[],
  timeoutMs: number = 10000
): Promise<{ ok: boolean; result: any; error?: string }> => {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params,
    id: 1,
  });
  
  const response = await httpPost(endpoint, body, timeoutMs);
  
  if (!response.ok) {
    return { ok: false, result: null, error: response.error };
  }
  
  if (response.data?.error) {
    return { 
      ok: false, 
      result: null, 
      error: response.data.error.message || 'API Error' 
    };
  }
  
  return { ok: true, result: response.data?.result };
};
