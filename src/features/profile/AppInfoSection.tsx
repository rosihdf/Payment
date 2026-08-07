import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { getAppBuildInfo } from '../../lib/appBuildInfo';
import {
  shouldOfferAndroidNativeApkInstall,
  type AndroidLatestManifest,
} from '../../lib/androidApkUpdate';
import { runAndroidSystemApkDownloadFlow } from '../../lib/androidApkInstallFlow';
import {
  isBlockingDownloadStatus,
  readAndroidApkDownloadState,
} from '../../lib/androidApkDownloadState';
import { AppUpdateDownload } from '../../lib/appUpdateDownload';
import { APP_DISPLAY_NAME } from '../../utils/appInfo';
import styles from './ProfilePage.module.css';

function formatServerVersionHint(m: AndroidLatestManifest | null): string {
  if (!m) return '—';
  const semver = m.latestVersion?.trim();
  const code = typeof m.versionCode === 'number' ? String(m.versionCode) : '';
  const parts = [semver || null, code ? `Build ${code}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

/**
 * App-Info Updatebereich — DownloadManager-Pfad, kein eigener Installer.
 */
export function AppInfoSection() {
  const ctx = useAndroidApkUpdateOptional();
  const info = getAppBuildInfo();
  const [busy, setBusy] = useState(false);
  const [flowMessage, setFlowMessage] = useState<string | null>(null);
  const [downloadActive, setDownloadActive] = useState(false);

  const refreshManifest = ctx?.refreshManifest;
  const installKind = ctx?.installKind;

  useEffect(() => {
    if (installKind === 'android' && refreshManifest) {
      void refreshManifest({ reason: 'info_mount' });
    }
  }, [installKind, refreshManifest]);

  const refreshDownloadActive = useCallback(async () => {
    const code = ctx?.manifest?.versionCode;
    if (typeof code !== 'number') {
      setDownloadActive(false);
      return;
    }
    const state = readAndroidApkDownloadState();
    if (state == null || state.versionCode !== Math.trunc(code)) {
      setDownloadActive(false);
      return;
    }
    try {
      const st = await AppUpdateDownload.getDownloadStatus({ downloadId: state.downloadId });
      setDownloadActive(isBlockingDownloadStatus(st.status));
    } catch {
      setDownloadActive(false);
    }
  }, [ctx?.manifest?.versionCode]);

  useEffect(() => {
    void refreshDownloadActive();
  }, [refreshDownloadActive, ctx?.verdict?.kind]);

  const installedLabel = `${info.version}${
    info.androidGradleVersionCode != null
      ? ` · APK ${info.androidGradleVersionName || '—'} (#${info.androidGradleVersionCode})`
      : ''
  }`;

  const nativeInstallEligible = useMemo(
    () => (ctx ? shouldOfferAndroidNativeApkInstall(ctx.installed, ctx.manifest) : false),
    [ctx],
  );

  const canOfferDownload =
    Boolean(ctx) &&
    ctx!.installKind === 'android' &&
    nativeInstallEligible &&
    ctx!.online &&
    ctx!.manifest != null &&
    !ctx!.loadFailed &&
    ctx!.hasCheckedOnce &&
    !ctx!.checking &&
    !downloadActive;

  const showCurrentVersionHint =
    Boolean(ctx) &&
    ctx!.hasCheckedOnce &&
    !ctx!.checking &&
    ctx!.online &&
    ctx!.manifest != null &&
    !ctx!.loadFailed &&
    ctx!.verdict?.kind === 'current';

  const handleCheckUpdates = useCallback(async () => {
    if (!ctx) return;
    setFlowMessage(null);
    await ctx.refreshManifest({ force: true, reason: 'manual' });
  }, [ctx]);

  const handleDownload = async () => {
    if (!canOfferDownload || ctx?.manifest == null) return;
    setFlowMessage(null);
    setBusy(true);
    try {
      const res = await runAndroidSystemApkDownloadFlow(ctx.manifest);
      if (res.ok) {
        setFlowMessage(res.notice);
        setDownloadActive(true);
      } else {
        setFlowMessage(res.message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!ctx || ctx.installKind !== 'android') {
    return (
      <section className={styles.appInfo} aria-labelledby="app-info-heading">
        <h2 id="app-info-heading" className={styles.sectionTitle}>
          App-Info
        </h2>
        <dl className={styles.appInfoList}>
          <div className={styles.row}>
            <dt>App</dt>
            <dd>{APP_DISPLAY_NAME}</dd>
          </div>
          <div className={styles.row}>
            <dt>Version</dt>
            <dd>{info.version}</dd>
          </div>
          <div className={styles.row}>
            <dt>Hinweis</dt>
            <dd>Updateprüfung nur in der nativen Android-App.</dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className={styles.appInfo} aria-labelledby="app-info-heading">
      <h2 id="app-info-heading" className={styles.sectionTitle}>
        App-Info
      </h2>
      <p className={styles.appInfoMessage}>
        „Jetzt installieren“ startet den Android-Systemdownload. Danach tippst du auf die
        Download-Benachrichtigung — Payment installiert nicht selbst.
      </p>

      {showCurrentVersionHint ? (
        <p className={styles.devToast} role="status">
          Die App ist aktuell
        </p>
      ) : null}

      {downloadActive ? (
        <p className={styles.devToast} role="status">
          Update wird über Android heruntergeladen
        </p>
      ) : null}

      {flowMessage ? <p className={styles.appInfoMessage}>{flowMessage}</p> : null}

      <dl className={styles.appInfoList}>
        <div className={styles.row}>
          <dt>App</dt>
          <dd>{APP_DISPLAY_NAME}</dd>
        </div>
        <div className={styles.row}>
          <dt>Installierte Version</dt>
          <dd>{installedLabel}</dd>
        </div>
        {ctx.hasCheckedOnce && !ctx.checking ? (
          <div className={styles.row}>
            <dt>Server (Manifest)</dt>
            <dd>
              {!ctx.online
                ? 'Offline — keine Versionsprüfung'
                : ctx.loadFailed
                  ? 'Manifest nicht geladen'
                  : formatServerVersionHint(ctx.manifest)}
            </dd>
          </div>
        ) : null}
        {ctx.checking ? (
          <div className={styles.row}>
            <dt>Status</dt>
            <dd>Update wird geprüft …</dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.appInfoActions}>
        <button
          type="button"
          className={styles.adminLink}
          disabled={ctx.checking || busy}
          onClick={() => {
            void handleCheckUpdates();
          }}
        >
          {ctx.checking
            ? 'Wird geprüft …'
            : !ctx.hasCheckedOnce
              ? 'Jetzt prüfen'
              : 'Erneut prüfen'}
        </button>

        {canOfferDownload ? (
          <button
            type="button"
            className={styles.adminLink}
            disabled={busy}
            onClick={() => {
              void handleDownload();
            }}
          >
            {busy ? 'Update wird heruntergeladen' : 'Jetzt installieren'}
          </button>
        ) : null}
      </div>
    </section>
  );
}
