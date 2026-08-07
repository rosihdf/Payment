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
import { getAppBuildInfo, type ClientInstallKind } from '../lib/appBuildInfo';
import {
  compareAndroidInstallToManifest,
  fetchAndroidLatestManifest,
  type AndroidInstalledSnapshot,
  type AndroidLatestManifest,
  type AndroidUpdateVerdict,
} from '../lib/androidApkUpdate';
import {
  ANDROID_APK_UPDATE_BACKGROUND_INTERVAL_MS,
  shouldRunAndroidApkUpdateCheck,
  type AndroidApkUpdateCheckReason,
} from '../lib/androidApkUpdateCheckPolicy';
import {
  ANDROID_APK_SNOOZE_RESET_EVENT,
  readSnoozedAndroidApkVersionCode,
  writeSnoozedAndroidApkVersionCode,
} from '../lib/androidApkUpdateBanner';
import { clearAndroidApkDownloadStateIfCurrent } from '../lib/androidApkInstallFlow';
import { isOnline, subscribeNetworkStatus } from '../lib/networkOnline';

export type AndroidApkUpdateRefreshOptions = {
  force?: boolean;
  reason?: AndroidApkUpdateCheckReason;
};

export type AndroidApkUpdateContextValue = {
  installKind: ClientInstallKind;
  installed: AndroidInstalledSnapshot;
  manifest: AndroidLatestManifest | null;
  checking: boolean;
  loadFailed: boolean;
  hasCheckedOnce: boolean;
  online: boolean;
  verdict: AndroidUpdateVerdict | null;
  snoozedVersionCode: number | null;
  refreshManifest: (opts?: AndroidApkUpdateRefreshOptions) => Promise<void>;
  snoozeCurrentManifest: () => void;
};

const AndroidApkUpdateContext = createContext<AndroidApkUpdateContextValue | null>(null);

export function useAndroidApkUpdate(): AndroidApkUpdateContextValue {
  const ctx = useContext(AndroidApkUpdateContext);
  if (ctx == null) {
    throw new Error('useAndroidApkUpdate must be within AndroidApkUpdateProvider');
  }
  return ctx;
}

export function useAndroidApkUpdateOptional(): AndroidApkUpdateContextValue | null {
  return useContext(AndroidApkUpdateContext);
}

export function AndroidApkUpdateProvider({ children }: { children: ReactNode }) {
  const info = getAppBuildInfo();
  const installKind = info.installKind;

  const installed = useMemo<AndroidInstalledSnapshot>(
    () => ({
      bundleSemver: info.version,
      nativeVersionCode: info.androidGradleVersionCode,
      nativeVersionName: info.androidGradleVersionName,
    }),
    [info.androidGradleVersionCode, info.androidGradleVersionName, info.version],
  );

  const [checking, setChecking] = useState(false);
  const [manifest, setManifest] = useState<AndroidLatestManifest | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  const [networkTick, setNetworkTick] = useState(0);
  const [snoozedVersionCode, setSnoozedVersionCode] = useState<number | null>(() =>
    readSnoozedAndroidApkVersionCode(),
  );

  const lastCheckAtRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const wasOnlineRef = useRef(isOnline());

  useEffect(() => subscribeNetworkStatus(() => setNetworkTick((n) => n + 1)), []);

  useEffect(() => {
    const syncSnooze = (): void => setSnoozedVersionCode(readSnoozedAndroidApkVersionCode());
    if (typeof window === 'undefined') return undefined;
    window.addEventListener(ANDROID_APK_SNOOZE_RESET_EVENT, syncSnooze);
    return () => window.removeEventListener(ANDROID_APK_SNOOZE_RESET_EVENT, syncSnooze);
  }, []);

  const online = useMemo(() => {
    void networkTick;
    return isOnline();
  }, [networkTick]);

  const refreshManifest = useCallback(
    async (opts?: AndroidApkUpdateRefreshOptions): Promise<void> => {
      if (installKind !== 'android') {
        return;
      }

      const reason = opts?.reason ?? 'interval';
      const force = opts?.force === true;
      const now = Date.now();

      if (!shouldRunAndroidApkUpdateCheck(lastCheckAtRef.current, now, reason, force)) {
        return;
      }

      if (inFlightRef.current && !force) {
        return;
      }

      if (!isOnline()) {
        setChecking(false);
        setLoadFailed(false);
        setManifest(null);
        setHasCheckedOnce(true);
        lastCheckAtRef.current = now;
        return;
      }

      inFlightRef.current = true;
      setChecking(true);
      setLoadFailed(false);

      try {
        const m = await fetchAndroidLatestManifest();
        setManifest(m);
        setLoadFailed(m == null);
      } finally {
        setChecking(false);
        setHasCheckedOnce(true);
        lastCheckAtRef.current = Date.now();
        inFlightRef.current = false;
      }
    },
    [installKind],
  );

  const snoozeCurrentManifest = useCallback((): void => {
    if (manifest == null || typeof manifest.versionCode !== 'number') return;
    writeSnoozedAndroidApkVersionCode(manifest.versionCode);
    setSnoozedVersionCode(Math.trunc(manifest.versionCode));
  }, [manifest]);

  useEffect(() => {
    if (installKind !== 'android') return;
    void refreshManifest({ reason: 'initial' });
  }, [installKind, refreshManifest]);

  useEffect(() => {
    if (installKind !== 'android') return;

    const onVisibilityResume = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refreshManifest({ reason: 'resume' });
    };

    document.addEventListener('visibilitychange', onVisibilityResume);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityResume);
    };
  }, [installKind, refreshManifest]);

  useEffect(() => {
    if (installKind !== 'android') return undefined;

    const id = window.setInterval(() => {
      void refreshManifest({ reason: 'interval' });
    }, ANDROID_APK_UPDATE_BACKGROUND_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [installKind, refreshManifest]);

  useEffect(() => {
    if (installKind !== 'android') return;
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = online;
    if (!wasOnline && online) {
      void refreshManifest({ reason: 'network_online' });
    }
  }, [installKind, online, refreshManifest]);

  const verdict = useMemo(
    () => (manifest ? compareAndroidInstallToManifest(installed, manifest) : null),
    [installed, manifest],
  );

  useEffect(() => {
    if (verdict?.kind === 'current') {
      clearAndroidApkDownloadStateIfCurrent(installed.nativeVersionCode);
    }
  }, [verdict, installed.nativeVersionCode]);

  const value = useMemo<AndroidApkUpdateContextValue>(
    () => ({
      installKind,
      installed,
      manifest,
      checking,
      loadFailed,
      hasCheckedOnce,
      online,
      verdict,
      snoozedVersionCode,
      refreshManifest,
      snoozeCurrentManifest,
    }),
    [
      installKind,
      installed,
      manifest,
      checking,
      loadFailed,
      hasCheckedOnce,
      online,
      verdict,
      snoozedVersionCode,
      refreshManifest,
      snoozeCurrentManifest,
    ],
  );

  return (
    <AndroidApkUpdateContext.Provider value={value}>{children}</AndroidApkUpdateContext.Provider>
  );
}
