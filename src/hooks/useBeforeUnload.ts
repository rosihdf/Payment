import { useEffect } from 'react';

export function useBeforeUnload(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);
}
