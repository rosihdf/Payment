import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { getAppBuildInfo } from '../../lib/appBuildInfo';
import {
  resolveApkDownloadUrl,
  shouldOfferAndroidNativeApkInstall,
  type AndroidLatestManifest,
} from '../../lib/androidApkUpdate';
import { runAndroidNativeApkInstallFlow } from '../../lib/androidApkInstallFlow';
import {
  ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY,
  ANDROID_APK_SNOOZE_RESET_EVENT,
  notifyAndroidApkSnoozeReset,
  readSnoozedAndroidApkVersionCode,
} from '../../lib/androidApkUpdateBanner';
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
 * App-Info Updatebereich — Verhalten wie ArioVan Wartung `AndroidApkUpdateSettingsCard`.
 * Shared Manifest-State kommt aus dem Provider (Visibility/Resume); manuelle Prüfung erzwingt Force.
 */
export function AppInfoSection() {
  const ctx = useAndroidApkUpdateOptional();
  const info = getAppBuildInfo();
  const [nativeInstallBusy, setNativeInstallBusy] = useState(false);
  const [postInstallerNotice, setPostInstallerNotice] = useState<string | null>(null);
  const [installFlowMessage, setInstallFlowMessage] = useState<string | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [bannerSnoozeCode, setBannerSnoozeCode] = useState<number | null>(() =>
    typeof window !== 'undefined' ? readSnoozedAndroidApkVersionCode() : null,
  );

  const refreshManifest = ctx?.refreshManifest;
  const installKind = ctx?.installKind;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sync = (): void => setBannerSnoozeCode(readSnoozedAndroidApkVersionCode());
    window.addEventListener(ANDROID_APK_SNOOZE_RESET_EVENT, sync);
    return () => window.removeEventListener(ANDROID_APK_SNOOZE_RESET_EVENT, sync);
  }, []);

  useEffect(() => {
    if (installKind === 'android' && refreshManifest) {
      void refreshManifest({ reason: 'info_mount' });
    }
  }, [installKind, refreshManifest]);

  const installedLabel = `${info.version}${
    info.androidGradleVersionCode != null
      ? ` · APK ${info.androidGradleVersionName || '—'} (#${info.androidGradleVersionCode})`
      : ''
  }`;

  const nativeInstallEligible = useMemo(
    () => (ctx ? shouldOfferAndroidNativeApkInstall(ctx.installed, ctx.manifest) : false),
    [ctx],
  );

  const canOfferNativeInstallPrimary =
    Boolean(ctx) &&
    ctx!.installKind === 'android' &&
    nativeInstallEligible &&
    ctx!.online &&
    ctx!.manifest != null &&
    !ctx!.loadFailed &&
    ctx!.hasCheckedOnce &&
    !ctx!.checking;

  const showNewerBanner = ctx?.verdict?.kind === 'newer' && !promptDismissed;
  const uncertainReason =
    ctx?.verdict?.kind === 'uncertain' && !promptDismissed ? ctx.verdict.reason : null;

  const showCurrentVersionHint =
    Boolean(ctx) &&
    ctx!.hasCheckedOnce &&
    !ctx!.checking &&
    ctx!.online &&
    ctx!.manifest != null &&
    !ctx!.loadFailed &&
    ctx!.verdict?.kind === 'current';

  const bannerSnoozeHidesHeadline =
    nativeInstallEligible &&
    ctx?.manifest != null &&
    typeof ctx.manifest.versionCode === 'number' &&
    bannerSnoozeCode != null &&
    bannerSnoozeCode === Math.trunc(ctx.manifest.versionCode);

  const browserApkFallbackLabel =
    ctx?.loadFailed ||
    ctx?.verdict?.kind === 'uncertain' ||
    ctx?.verdict?.kind === 'newer' ||
    nativeInstallEligible
      ? 'APK im Browser herunterladen'
      : 'Aktuelle APK im Browser herunterladen';

  const handleCheckUpdates = useCallback(async () => {
    if (!ctx) return;
    setPromptDismissed(false);
    await ctx.refreshManifest({ force: true, reason: 'manual' });
  }, [ctx]);

  const handleNativeInstall = async () => {
    if (!canOfferNativeInstallPrimary || ctx?.manifest == null) return;
    setPostInstallerNotice(null);
    setInstallFlowMessage(null);
    setNativeInstallBusy(true);
    try {
      const res = await runAndroidNativeApkInstallFlow(ctx.manifest);
      if (res.ok) {
        setPostInstallerNotice(res.notice);
      } else {
        setInstallFlowMessage(res.message);
      }
    } finally {
      setNativeInstallBusy(false);
    }
  };

  const handleDownloadApkInBrowser = () => {
    const url = resolveApkDownloadUrl(ctx?.manifest ?? null);
    window.open(url, '_blank', 'noopener,noreferrer');
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
        „Update installieren“ lädt die APK intern und öffnet den Paketinstaller — nur wenn die Build-Nummer
        (versionCode) auf dem Server höher ist. Es gibt keine stillschweigende Installation. Als Fallback gibt es
        einen Browser-Link zur APK.
      </p>

      {postInstallerNotice ? <p className={styles.devToast}>{postInstallerNotice}</p> : null}
      {installFlowMessage ? (
        <p className={styles.appInfoMessage} role="alert">
          {installFlowMessage}
        </p>
      ) : null}

      {bannerSnoozeHidesHeadline ? (
        <p className={styles.appInfoMessage}>
          Der Hinweis unter der Kopfzeile ist für diese Build-Nummer ausgeblendet (Später am Banner). Über „Update
          installieren“ hier können Sie trotzdem installieren.
        </p>
      ) : null}

      {showCurrentVersionHint ? (
        <p className={styles.devToast} role="status">
          Sie nutzen die aktuelle Version.
        </p>
      ) : null}

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
                  ? 'Manifest nicht geladen — Browser-Fallback möglich'
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

      {showNewerBanner ? (
        <div className={styles.updatePrompt} role="status">
          <p className={styles.updatePromptTitle}>App-Update verfügbar</p>
          <p className={styles.appInfoMessage}>
            {nativeInstallEligible
              ? 'Neue Version gefunden — mit „Update installieren“ lädt die App die APK intern und öffnet den Paketinstaller.'
              : 'Die Versionsbezeichnung auf dem Server wirkt neuer, aber die Build-Nummer (versionCode) ist hier nicht höher. Primäres „Update installieren“ ist deshalb nicht aktiv.'}
          </p>
          <div className={styles.appInfoActions}>
            {nativeInstallEligible ? (
              <button
                type="button"
                className={styles.adminLink}
                disabled={nativeInstallBusy || !ctx.online || !canOfferNativeInstallPrimary}
                onClick={() => {
                  void handleNativeInstall();
                }}
              >
                {nativeInstallBusy ? 'Update wird heruntergeladen …' : 'Update installieren'}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.adminLink}
              disabled={nativeInstallBusy}
              onClick={handleDownloadApkInBrowser}
            >
              {browserApkFallbackLabel}
            </button>
            <button
              type="button"
              className={styles.adminLink}
              disabled={nativeInstallBusy}
              onClick={() => setPromptDismissed(true)}
            >
              Später
            </button>
          </div>
        </div>
      ) : null}

      {uncertainReason != null ? (
        <div className={styles.updatePrompt} role="status">
          <p className={styles.updatePromptTitle}>Update prüfen</p>
          <p className={styles.appInfoMessage}>{uncertainReason}</p>
          <div className={styles.appInfoActions}>
            <button
              type="button"
              className={styles.adminLink}
              disabled={nativeInstallBusy}
              onClick={handleDownloadApkInBrowser}
            >
              {browserApkFallbackLabel}
            </button>
            <button
              type="button"
              className={styles.adminLink}
              disabled={nativeInstallBusy}
              onClick={() => setPromptDismissed(true)}
            >
              Später
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.appInfoActions}>
        <button
          type="button"
          className={styles.adminLink}
          disabled={ctx.checking || nativeInstallBusy}
          onClick={() => {
            void handleCheckUpdates();
          }}
        >
          {ctx.checking ? 'Wird geprüft …' : 'Jetzt prüfen'}
        </button>

        {canOfferNativeInstallPrimary ? (
          <button
            type="button"
            className={styles.adminLink}
            disabled={nativeInstallBusy || ctx.checking || !ctx.online}
            onClick={() => {
              void handleNativeInstall();
            }}
          >
            {nativeInstallBusy ? 'Update wird heruntergeladen …' : 'Update installieren'}
          </button>
        ) : null}

        <button
          type="button"
          className={styles.adminLink}
          disabled={nativeInstallBusy}
          onClick={handleDownloadApkInBrowser}
        >
          {browserApkFallbackLabel}
        </button>
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
    </section>
  );
}
