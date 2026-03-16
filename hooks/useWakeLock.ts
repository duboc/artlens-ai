import { useState, useEffect, useCallback, useRef } from 'react';

interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
}

export const useWakeLock = (): UseWakeLockReturn => {
  const isSupported = 'wakeLock' in navigator;
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const request = useCallback(async () => {
    if (!isSupported) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });
    } catch {
      // Wake lock request failed (e.g., low battery, page not visible)
      setIsActive(false);
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
      setIsActive(false);
    }
  }, []);

  // Acquire on mount, release on unmount
  useEffect(() => {
    request();
    return () => { release(); };
  }, [request, release]);

  // Re-acquire when page becomes visible (API auto-releases on hide)
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isSupported, request]);

  return { isSupported, isActive };
};
