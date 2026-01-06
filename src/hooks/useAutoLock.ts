/**
 * Auto-Lock Hook
 * Automatically locks the wallet after a period of inactivity
 * Better UX than logout - user stays logged in but needs to unlock
 */

import { useEffect, useCallback, useRef } from 'react';

// Auto-lock configuration (in milliseconds)
const AUTO_LOCK_CONFIG = {
  // Default timeout: 15 minutes of inactivity
  INACTIVITY_TIMEOUT: 15 * 60 * 1000,
  
  // Warning before lock: 1 minute
  WARNING_BEFORE_LOCK: 60 * 1000,
  
  // Events that reset the inactivity timer
  ACTIVITY_EVENTS: [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
    'focus'
  ] as const,
};

interface UseAutoLockOptions {
  /**
   * Timeout duration in milliseconds (default: 15 minutes)
   */
  timeout?: number;
  
  /**
   * Callback when wallet is about to lock (warning)
   */
  onWarning?: (remainingTime: number) => void;
  
  /**
   * Callback when wallet should be locked
   */
  onLock?: () => void;
  
  /**
   * Whether the auto-lock is enabled (default: true when logged in)
   */
  enabled?: boolean;
}

export const useAutoLock = ({
  timeout = AUTO_LOCK_CONFIG.INACTIVITY_TIMEOUT,
  onWarning,
  onLock,
  enabled = true,
}: UseAutoLockOptions = {}) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  // Handle wallet lock
  const handleLock = useCallback(() => {
    clearTimers();
    onLock?.();
  }, [clearTimers, onLock]);

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();
    clearTimers();

    // Set warning timer (fires 1 minute before lock)
    const warningTime = timeout - AUTO_LOCK_CONFIG.WARNING_BEFORE_LOCK;
    if (warningTime > 0 && onWarning) {
      warningRef.current = setTimeout(() => {
        const remaining = Math.ceil(AUTO_LOCK_CONFIG.WARNING_BEFORE_LOCK / 1000);
        onWarning(remaining);
      }, warningTime);
    }

    // Set lock timer
    timeoutRef.current = setTimeout(() => {
      handleLock();
    }, timeout);
  }, [enabled, timeout, onWarning, handleLock, clearTimers]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // Throttle activity resets to avoid performance issues
    let lastResetTime = 0;
    const throttleMs = 1000;

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastResetTime > throttleMs) {
        lastResetTime = now;
        resetTimer();
      }
    };

    // Add event listeners for all activity events
    AUTO_LOCK_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the initial timer
    resetTimer();

    // Cleanup
    return () => {
      clearTimers();
      AUTO_LOCK_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer, clearTimers]);

  // Reset timers when timeout value changes (user preference updated)
  const prevTimeoutRef = useRef(timeout);
  useEffect(() => {
    if (enabled && prevTimeoutRef.current !== timeout) {
      prevTimeoutRef.current = timeout;
      // Timeout changed while hook is active, reset the timer with new duration
      resetTimer();
    }
  }, [enabled, timeout, resetTimer]);

  // Get time since last activity
  const getTimeSinceLastActivity = useCallback(() => {
    return Date.now() - lastActivityRef.current;
  }, []);

  // Manually extend the session (e.g., after unlock)
  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  return {
    resetTimer,
    extendSession,
    getTimeSinceLastActivity,
    clearTimers,
  };
};

export default useAutoLock;
