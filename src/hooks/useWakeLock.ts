import { useEffect, useRef, useState } from 'react';

/**
 * Keeps mobile phone screen awake during synchronized audio playback,
 * preventing mobile browsers from muting audio or suspending timers.
 */
export function useWakeLock(enabled: boolean) {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    let released = false;

    async function requestLock() {
      if ('wakeLock' in navigator && enabled) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          if (!released) {
            setIsLocked(true);
            wakeLockRef.current.addEventListener('release', () => {
              setIsLocked(false);
            });
          }
        } catch {
          setIsLocked(false);
        }
      }
    }

    if (enabled) {
      requestLock();
    } else {
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
        setIsLocked(false);
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);

  return { isLocked };
}
