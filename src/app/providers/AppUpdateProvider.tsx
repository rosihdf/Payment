import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppUpdateSnapshot } from '../../domain/appUpdate/updateManifest';
import {
  AppUpdateService,
  createAppUpdateService,
} from '../../services/appUpdateService';
import { CurrentUserContext } from './currentUserContext';

interface AppUpdateContextValue {
  snapshot: AppUpdateSnapshot;
  checkNow: () => Promise<AppUpdateSnapshot>;
  openDownload: () => Promise<{ ok: true } | { ok: false; error: string }>;
  dismissOptional: () => void;
  shouldShowOptionalBanner: boolean;
  service: AppUpdateService;
}

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

interface AppUpdateProviderProps {
  children: ReactNode;
  service?: AppUpdateService;
}

export function AppUpdateProvider({ children, service: injected }: AppUpdateProviderProps) {
  const service = useMemo(() => injected ?? createAppUpdateService(), [injected]);
  const currentUserCtx = useContext(CurrentUserContext);
  const currentUser = currentUserCtx?.currentUser ?? null;
  const isLoading = currentUserCtx?.isLoading ?? false;
  const [snapshot, setSnapshot] = useState<AppUpdateSnapshot>(() => service.getSnapshot());
  const [bannerEpoch, setBannerEpoch] = useState(0);
  const startedForUserRef = useRef<string | null>(null);

  const sync = useCallback(() => {
    setSnapshot(service.getSnapshot());
    setBannerEpoch((value) => value + 1);
  }, [service]);

  const runAutomaticCheck = useCallback(async () => {
    if (!service.shouldAutoCheck() || !service.shouldRunAutomaticCheck()) {
      sync();
      return;
    }
    try {
      const next = await service.checkForUpdate({ automatic: true });
      setSnapshot(next);
      setBannerEpoch((value) => value + 1);
    } catch {
      sync();
    }
  }, [service, sync]);

  const checkNow = useCallback(async () => {
    const next = await service.checkForUpdate({ manual: true });
    setSnapshot(next);
    setBannerEpoch((value) => value + 1);
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

  // Auto-Check erst nach Auth + geladenem Profil, nicht auf dem Login.
  useEffect(() => {
    if (!currentUserCtx) {
      sync();
      return;
    }
    if (isLoading || !currentUser) {
      startedForUserRef.current = null;
      sync();
      return;
    }
    if (!service.shouldAutoCheck()) {
      sync();
      return;
    }
    if (startedForUserRef.current === currentUser.id) {
      return;
    }
    startedForUserRef.current = currentUser.id;
    void runAutomaticCheck();
  }, [currentUser, currentUserCtx, isLoading, runAutomaticCheck, service, sync]);

  // Vordergrund: nur wenn 24h-Intervall abgelaufen.
  useEffect(() => {
    if (typeof document === 'undefined' || !currentUserCtx) {
      return;
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (isLoading || !currentUser || !service.shouldAutoCheck()) {
        return;
      }
      void runAutomaticCheck();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUser, currentUserCtx, isLoading, runAutomaticCheck, service]);

  const shouldShowOptionalBanner = useMemo(
    () => service.shouldShowOptionalBanner(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutable service snapshot
    [service, snapshot, bannerEpoch],
  );

  const value = useMemo(
    () => ({
      snapshot,
      checkNow,
      openDownload,
      dismissOptional,
      shouldShowOptionalBanner,
      service,
    }),
    [snapshot, checkNow, openDownload, dismissOptional, shouldShowOptionalBanner, service],
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
