/** Einfacher Online-Status für den Wartungs-Updatepfad (navigator). */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function subscribeNetworkStatus(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}
