/** Einfacher Online-Status für Update-Checks (navigator.onLine). */
export const isOnline = (): boolean => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
};

export const subscribeNetworkStatus = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
};
