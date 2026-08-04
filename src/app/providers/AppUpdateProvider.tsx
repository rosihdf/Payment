import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppUpdateSnapshot } from '../../domain/appUpdate/updateManifest';
import {
  AppUpdateService,
  createAppUpdateService,
} from '../../services/appUpdateService';

interface AppUpdateContextValue {
  snapshot: AppUpdateSnapshot;
  checkNow: () => Promise<AppUpdateSnapshot>;
  openDownload: () => Promise<{ ok: true } | { ok: false; error: string }>;
  dismissOptional: () => void;
  service: AppUpdateService;
}

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

interface AppUpdateProviderProps {
  children: ReactNode;
  service?: AppUpdateService;
}

export function AppUpdateProvider({ children, service: injected }: AppUpdateProviderProps) {
  const service = useMemo(() => injected ?? createAppUpdateService(), [injected]);
  const [snapshot, setSnapshot] = useState<AppUpdateSnapshot>(() => service.getSnapshot());

  const sync = useCallback(() => {
    setSnapshot(service.getSnapshot());
  }, [service]);

  const checkNow = useCallback(async () => {
    const next = await service.checkForUpdate({ manual: true });
    setSnapshot(next);
    return next;
  }, [service]);

  const openDownload = useCallback(async () => {
    const result = await service.openVerifiedDownload();
    sync();
    return result;
  }, [service, sync]);

  const dismissOptional = useCallback(() => {
    service.dismissOptionalUpdate();
    sync();
  }, [service, sync]);

  useEffect(() => {
    if (!service.shouldAutoCheck()) {
      sync();
      return;
    }
    let cancelled = false;
    void service.checkForUpdate().then((next) => {
      if (!cancelled) {
        setSnapshot(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [service, sync]);

  const value = useMemo(
    () => ({
      snapshot,
      checkNow,
      openDownload,
      dismissOptional,
      service,
    }),
    [snapshot, checkNow, openDownload, dismissOptional, service],
  );

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
}

export function useAppUpdate(): AppUpdateContextValue {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error('useAppUpdate must be used within AppUpdateProvider');
  }
  return context;
}
