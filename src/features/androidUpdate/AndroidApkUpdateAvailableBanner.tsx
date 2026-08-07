import { useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { useAndroidApkDownloadProgress } from '../../hooks/useAndroidApkDownloadProgress';
import { evaluateAndroidApkUpdateBannerVisibility } from '../../lib/androidApkUpdateBanner';
import {
  openAndroidDownloadedApk,
  runAndroidSystemApkDownloadFlow,
} from '../../lib/androidApkInstallFlow';
import styles from '../appUpdate/AppUpdateGate.module.css';

/** Globaler Hinweis: Update via Android DownloadManager — ohne REQUEST_INSTALL_PACKAGES. */
export function AndroidApkUpdateAvailableBanner() {
  const ctx = useAndroidApkUpdateOptional();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useAndroidApkDownloadProgress({
    enabled: ctx?.installKind === 'android',
    offeredVersionCode: ctx?.manifest?.versionCode,
    installedVersionCode: ctx?.installed.nativeVersionCode,
  });

  const bannerInput =
    ctx == null
      ? null
      : {
          installKind: ctx.installKind,
          online: ctx.online,
          checking: ctx.checking,
          manifestLoadFailed: ctx.loadFailed,
          manifest: ctx.manifest,
          installed: ctx.installed,
          snoozedVersionCode: ctx.snoozedVersionCode,
          installBusy: busy,
        };

  const visibilityEval =
    bannerInput == null
      ? { shouldShow: false as const, reasonIfHidden: 'no_provider' as const }
      : evaluateAndroidApkUpdateBannerVisibility(bannerInput);

  if (ctx == null || ctx.installKind !== 'android') {
    return null;
  }

  const { manifest } = ctx;
  if (!visibilityEval.shouldShow || manifest == null) {
    return null;
  }

  const handleLater = () => {
    ctx.snoozeCurrentManifest();
  };

  const handlePrimaryClick = async () => {
    if (!visibilityEval.shouldShow || busy) return;
    if (download.phase === 'downloading') return;

    setError(null);
    setBusy(true);
    try {
      if (download.phase === 'downloaded' && download.downloadId != null) {
        const res = await openAndroidDownloadedApk(download.downloadId);
        if (!res.ok) setError(res.message);
        return;
      }

      const res = await runAndroidSystemApkDownloadFlow(manifest);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await download.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handlePrimaryKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void handlePrimaryClick();
    }
  };

  const downloading = download.phase === 'downloading' || busy;
  const downloaded = download.phase === 'downloaded';

  const primaryLabel = downloading
    ? 'Wird heruntergeladen …'
    : downloaded
      ? 'Jetzt installieren'
      : 'Jetzt installieren';

  const subtitle = downloading
    ? 'Update wird über Android heruntergeladen.'
    : downloaded
      ? 'Update heruntergeladen — tippe auf „Jetzt installieren“, um die APK zu öffnen.'
      : 'Tippe auf „Jetzt installieren“, um den Android-Systemdownload zu starten.';

  const statusLine = downloading
    ? 'Update wird heruntergeladen'
    : downloaded
      ? 'Update heruntergeladen'
      : null;

  return (
    <div className={styles.optionalBanner} role="region" aria-label="Android App-Update verfügbar">
      <div className={styles.bannerText}>
        <strong className={styles.bannerTitle}>Neue Version verfügbar</strong>
        {statusLine ? <span className={styles.bannerSubtitle}>{statusLine}</span> : null}
        <span className={styles.bannerSubtitle}>{subtitle}</span>
        {error != null ? <span className={styles.bannerError}>{error}</span> : null}
        {download.phase === 'failed' ? (
          <span className={styles.bannerError}>Download fehlgeschlagen — bitte erneut versuchen.</span>
        ) : null}
        <Link to="/profile" className={styles.bannerSubtitle}>
          Details
        </Link>
      </div>
      <div className={styles.bannerActions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void handlePrimaryClick()}
          onKeyDown={handlePrimaryKeyDown}
          disabled={downloading}
          aria-busy={busy || download.phase === 'downloading' ? 'true' : 'false'}
          aria-label={
            downloaded
              ? 'Heruntergeladene APK zur Installation öffnen'
              : 'Update über Android DownloadManager starten'
          }
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleLater}
          disabled={busy}
          aria-label="Update-Hinweis für diese Version ausblenden"
        >
          Später
        </button>
      </div>
    </div>
  );
}
