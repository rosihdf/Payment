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
  startInstall: () => Promise<{ ok: true } | { ok: false; error: string }>;
  openInstaller: () => Promise<{ ok: true } | { ok: false; error: string }>;
  cancelDownload: () => Promise<void>;
  dismissOptional: () => void;
  openUnknownSourcesSettings: () => Promise<void>;
  openBrowserFallback: () => { ok: true } | { ok: false; error: string };
  shouldShowOptionalBanner: boolean;
  shouldShowBannerLaterAction: boolean;
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
  const startedForUserRef = useRef<string | null>(null);
  const resumeInFlightRef = useRef(false);

  useEffect(() => service.subscribe(setSnapshot), [service]);

  const runAutomaticCheck = useCallback(async () => {
    if (!service.shouldAutoCheck() || !service.shouldRunAutomaticCheck()) {
      return;
    }
    try {
      await service.checkForUpdate({ automatic: true });
    } catch {
      // Automatische Prüfung darf die App nicht blockieren.
    }
  }, [service]);

  /** Resume: immer native Version reconcilen; Manifest nur wenn Intervall erlaubt. */
  const runForegroundReconcile = useCallback(async () => {
    if (!service.shouldAutoCheck()) {
      return;
    }
    if (resumeInFlightRef.current) {
      return;
    }
    resumeInFlightRef.current = true;
    try {
      await service.reconcileAfterResume();
      await runAutomaticCheck();
    } catch {
      // Resume darf die App nicht blockieren.
    } finally {
      resumeInFlightRef.current = false;
    }
  }, [runAutomaticCheck, service]);

  const checkNow = useCallback(async () => service.checkForUpdate({ manual: true }), [service]);

  const startInstall = useCallback(async () => service.startInstall(), [service]);

  const openInstaller = useCallback(async () => service.openInstaller(), [service]);

  const cancelDownload = useCallback(async () => service.cancelDownload(), [service]);

  const dismissOptional = useCallback(() => {
    service.dismissOptionalUpdate();
  }, [service]);

  const openUnknownSourcesSettings = useCallback(
    async () => service.openUnknownSourcesSettings(),
    [service],
  );

  const openBrowserFallback = useCallback(() => service.openBrowserFallback(), [service]);

  useEffect(() => {
    if (!currentUserCtx) {
      return;
    }
    if (isLoading || !currentUser) {
      startedForUserRef.current = null;
      return;
    }
    if (!service.shouldAutoCheck()) {
      return;
    }
    if (startedForUserRef.current === currentUser.id) {
      return;
    }
    startedForUserRef.current = currentUser.id;
    void runForegroundReconcile();
  }, [currentUser, currentUserCtx, isLoading, runForegroundReconcile, service]);

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
      void runForegroundReconcile();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUser, currentUserCtx, isLoading, runForegroundReconcile, service]);

  const shouldShowOptionalBanner = service.shouldShowOptionalBanner();
  const shouldShowBannerLaterAction = service.shouldShowBannerLaterAction();

  const value = useMemo(
    () => ({
      snapshot,
      checkNow,
      startInstall,
      openInstaller,
      cancelDownload,
      dismissOptional,
      openUnknownSourcesSettings,
      openBrowserFallback,
      shouldShowOptionalBanner,
      shouldShowBannerLaterAction,
      service,
    }),
    [
      snapshot,
      checkNow,
      startInstall,
      openInstaller,
      cancelDownload,
      dismissOptional,
      openUnknownSourcesSettings,
      openBrowserFallback,
      shouldShowOptionalBanner,
      shouldShowBannerLaterAction,
      service,
    ],
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
