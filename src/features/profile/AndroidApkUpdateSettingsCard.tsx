import { useCallback, useEffect, useMemo, useState } from 'react';
import { isOnline, subscribeNetworkStatus } from '../../lib/networkOnline';
import type { AndroidLatestManifest } from '../../lib/androidApkUpdate';
import {
  ANDROID_FALLBACK_APK_URL,
  compareAndroidInstallToManifest,
  fetchAndroidLatestManifest,
  resolveAndroidUpdateManifestUrl,
  shouldOfferAndroidApkUpdate,
} from '../../lib/androidApkUpdate';
import { runAndroidNativeApkSystemHandoffFlow, openAndroidDownloadsFileManagerAgain } from '../../lib/androidApkSystemHandoffFlow';
import {
  ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY,
  ANDROID_APK_SNOOZE_RESET_EVENT,
  notifyAndroidApkSnoozeReset,
  readSnoozedAndroidApkVersionCode,
} from '../../lib/androidApkUpdateBanner';
import { getAppBuildInfo } from '../../lib/appBuildInfo';
import styles from '../profile/ProfilePage.module.css';

const formatServerVersionHint = (m: AndroidLatestManifest | null): string => {
  if (!m) return '—';
  const semver = m.latestVersion?.trim();
  const code = typeof m.versionCode === 'number' ? String(m.versionCode) : '';
  const parts = [semver || null, code ? `Build ${code}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
};

export function AndroidApkUpdateSettingsCard() {
  const info = getAppBuildInfo();
  const manifestUrl = resolveAndroidUpdateManifestUrl();

  const installed = useMemo(
    () =>
      ({
        bundleSemver: info.version,
        nativeVersionCode: info.androidGradleVersionCode,
        nativeVersionName: info.androidGradleVersionName,
      }) as const,
    [info.androidGradleVersionCode, info.androidGradleVersionName, info.version],
  );

  const [checking, setChecking] = useState(false);
  const [manifest, setManifest] = useState<AndroidLatestManifest | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  const [networkTick, setNetworkTick] = useState(0);
  const [installBusy, setInstallBusy] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [showOpenDownloads, setShowOpenDownloads] = useState(false);
  const [bannerSnoozeCode, setBannerSnoozeCode] = useState<number | null>(() =>
    typeof window !== 'undefined' ? readSnoozedAndroidApkVersionCode() : null,
  );

  useEffect(() => subscribeNetworkStatus(() => setNetworkTick((n) => n + 1)), []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncBannerSnooze = (): void => {
      setBannerSnoozeCode(readSnoozedAndroidApkVersionCode());
    };
    syncBannerSnooze();
    window.addEventListener(ANDROID_APK_SNOOZE_RESET_EVENT, syncBannerSnooze);
    return () => window.removeEventListener(ANDROID_APK_SNOOZE_RESET_EVENT, syncBannerSnooze);
  }, []);

  const online = useMemo(() => {
    void networkTick;
    return isOnline();
  }, [networkTick]);

  const verdict = manifest ? compareAndroidInstallToManifest(installed, manifest) : null;

  const updateEligible = useMemo(
    () => shouldOfferAndroidApkUpdate(installed, manifest),
    [installed, manifest],
  );

  const bannerSnoozeHidesHeadline =
    updateEligible &&
    manifest != null &&
    typeof manifest.versionCode === 'number' &&
    bannerSnoozeCode != null &&
    bannerSnoozeCode === Math.trunc(manifest.versionCode);

  const canOfferUpdatePrimary =
    updateEligible && online && manifest != null && !loadFailed && hasCheckedOnce && !checking;

  const handleCheckUpdates = useCallback(async () => {
    if (!online) {
      setLoadFailed(true);
      setManifest(null);
      setHasCheckedOnce(true);
      setPromptDismissed(false);
      return;
    }

    setPromptDismissed(false);
    setChecking(true);
    setLoadFailed(false);

    try {
      const m = await fetchAndroidLatestManifest();
      setManifest(m);
      setLoadFailed(m == null);
    } finally {
      setChecking(false);
      setHasCheckedOnce(true);
    }
  }, [online]);

  useEffect(() => {
    void handleCheckUpdates();
  }, [handleCheckUpdates]);

  const handleNativeInstallUpdateFlow = async () => {
    if (!canOfferUpdatePrimary || manifest == null) {
      return;
    }

    setInstallNotice(null);
    setInstallMessage(null);
    setShowOpenDownloads(false);
    setInstallBusy(true);

    try {
      const res = await runAndroidNativeApkSystemHandoffFlow(manifest);
      if (res.ok) {
        setInstallNotice(res.notice);
        setShowOpenDownloads(!res.fileManagerOpened);
      } else {
        setInstallMessage(res.message);
      }
    } finally {
      setInstallBusy(false);
    }
  };

  const handleOpenDownloads = async () => {
    setInstallMessage(null);
    const res = await openAndroidDownloadsFileManagerAgain();
    if (!res.ok) {
      setInstallMessage(res.message);
      return;
    }
    setShowOpenDownloads(false);
  };

  const showNewerBanner = verdict?.kind === 'newer' && !promptDismissed;
  const uncertainReason =
    verdict?.kind === 'uncertain' && !promptDismissed ? verdict.reason : null;
  const showCurrentVersionHint =
    hasCheckedOnce && !checking && online && manifest != null && !loadFailed && verdict?.kind === 'current';

  const installedLabel = `${info.version}${
    info.androidGradleVersionCode != null || info.androidGradleVersionName
      ? ` · APK ${info.androidGradleVersionName || '—'} (#${info.androidGradleVersionCode ?? '—'})`
      : ''
  }`;

  const updatePrimaryLabel = installBusy ? 'Update wird heruntergeladen …' : 'Update installieren';

  return (
    <div className={styles.updatePrompt} aria-labelledby="android-apk-update-heading">
      <h3 id="android-apk-update-heading" className={styles.updatePromptTitle}>
        App-Update (Android)
      </h3>
      <p className={styles.updateStatus}>
        „Update installieren“ lädt die APK herunter und öffnet „Eigene Dateien“ / Downloads. Tippe dort auf die APK und
        anschließend auf „Aktualisieren“ — nur wenn die Build-Nummer (versionCode) auf dem Server höher ist.
      </p>

      {installNotice != null ? (
        <p className={styles.appInfoMessage} role="status">
          {installNotice}
        </p>
      ) : null}

      {installMessage != null ? (
        <p className={styles.appInfoMessage} role="alert">
          {installMessage}
        </p>
      ) : null}

      {bannerSnoozeHidesHeadline ? (
        <p className={styles.appInfoMessage} role="status">
          Der Hinweis unter der Kopfzeile ist für diese Build-Nummer ausgeblendet. Hier kannst du trotzdem updaten.
        </p>
      ) : null}

      {showCurrentVersionHint ? (
        <p className={styles.appInfoMessage} role="status">
          Du nutzt die aktuelle Version.
          <span className={styles.mono}>
            {' '}
            Dieses Gerät: {installedLabel} · Server: {formatServerVersionHint(manifest)}
          </span>
        </p>
      ) : null}

      <dl className={styles.appInfoList}>
        <div className={styles.row}>
          <dt>Installierte Version</dt>
          <dd className={styles.mono}>{installedLabel}</dd>
        </div>
        {hasCheckedOnce && !checking ? (
          <div className={styles.row}>
            <dt>Server (Manifest)</dt>
            <dd className={styles.mono}>
              {!online
                ? 'Offline — keine Versionsprüfung'
                : loadFailed
                  ? 'Manifest nicht geladen'
                  : formatServerVersionHint(manifest)}
            </dd>
          </div>
        ) : null}
      </dl>

      {showNewerBanner ? (
        <div className={styles.updatePrompt} role="status">
          <p className={styles.updatePromptTitle}>App-Update verfügbar</p>
          <p className={styles.updateStatus}>
            {updateEligible
              ? 'Neue Version gefunden — mit „Update installieren“ wird die APK geladen und Downloads geöffnet.'
              : 'Die Versionsbezeichnung wirkt neuer, aber die Build-Nummer ist hier nicht höher.'}
          </p>
          {manifest?.releaseNotes ? (
            <p className={styles.updateStatus}>{manifest.releaseNotes}</p>
          ) : null}
          <div className={styles.appInfoActions}>
            {updateEligible ? (
              <button
                type="button"
                className={styles.adminLink}
                onClick={() => void handleNativeInstallUpdateFlow()}
                disabled={installBusy || !online || !canOfferUpdatePrimary}
                aria-busy={installBusy ? 'true' : 'false'}
              >
                {updatePrimaryLabel}
              </button>
            ) : null}
            {showOpenDownloads ? (
              <button
                type="button"
                className={styles.adminLink}
                onClick={() => void handleOpenDownloads()}
                disabled={installBusy}
              >
                Downloads öffnen
              </button>
            ) : (
              <button
                type="button"
                className={styles.adminLink}
                onClick={() => setPromptDismissed(true)}
                disabled={installBusy}
              >
                Später
              </button>
            )}
          </div>
        </div>
      ) : null}

      {uncertainReason != null ? (
        <div className={styles.updatePrompt} role="status">
          <p className={styles.updatePromptTitle}>Update prüfen</p>
          <p className={styles.updateStatus}>{uncertainReason}</p>
          <div className={styles.appInfoActions}>
            <button type="button" className={styles.adminLink} onClick={() => void handleNativeInstallUpdateFlow()}>
              Update installieren
            </button>
            <button type="button" className={styles.adminLink} onClick={() => setPromptDismissed(true)}>
              Später
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.appInfoActions}>
        <button
          type="button"
          disabled={checking || !online || installBusy}
          className={styles.adminLink}
          onClick={() => void handleCheckUpdates()}
        >
          {checking ? 'Suche…' : 'Nach Update suchen'}
        </button>
        {canOfferUpdatePrimary ? (
          <button
            type="button"
            disabled={!online || checking || installBusy}
            className={styles.adminLink}
            onClick={() => void handleNativeInstallUpdateFlow()}
          >
            {updatePrimaryLabel}
          </button>
        ) : null}
      </div>

      {import.meta.env.DEV ? (
        <button
          type="button"
          className={styles.devToast}
          onClick={() => {
            try {
              localStorage.removeItem(ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY);
            } catch {
              /* ignore */
            }
            notifyAndroidApkSnoozeReset();
          }}
        >
          DEV: Banner-Snooze zurücksetzen
        </button>
      ) : null}

      <p className={styles.updateStatus}>
        Manifest: <span className={styles.mono}>{manifestUrl}</span>
        <br />
        Fallback: <span className={styles.mono}>{ANDROID_FALLBACK_APK_URL}</span>
      </p>
      <p className={styles.updateStatus}>
        Falls Android die Installation blockiert, erlaube einmalig „Apps aus dieser Quelle zulassen“ für AMRtech Payment
        in den Android-Einstellungen.
      </p>
      {!online ? (
        <p className={styles.appInfoMessage} role="status">
          Offline: keine Versionsprüfung möglich.
        </p>
      ) : null}
    </div>
  );
}
