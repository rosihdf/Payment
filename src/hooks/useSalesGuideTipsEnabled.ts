import { useCallback, useState } from 'react';
import { STORAGE_KEYS, readStorageItem, writeStorageItem } from '../utils/storage';

function readTipsEnabled(): boolean {
  const stored = readStorageItem<boolean>(STORAGE_KEYS.salesGuideTipsEnabled);
  return stored !== false;
}

export function useSalesGuideTipsEnabled() {
  const [tipsEnabled, setTipsEnabledState] = useState(readTipsEnabled);

  const setTipsEnabled = useCallback((enabled: boolean) => {
    setTipsEnabledState(enabled);
    writeStorageItem(STORAGE_KEYS.salesGuideTipsEnabled, enabled);
  }, []);

  const toggleTips = useCallback(() => {
    setTipsEnabledState((current) => {
      const next = !current;
      writeStorageItem(STORAGE_KEYS.salesGuideTipsEnabled, next);
      return next;
    });
  }, []);

  return { tipsEnabled, setTipsEnabled, toggleTips };
}
