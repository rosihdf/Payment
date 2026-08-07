import { useEffect, useState, type KeyboardEvent } from 'react';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { evaluateAndroidApkUpdateBannerVisibility } from '../../lib/androidApkUpdateBanner';
import {
  isAndroidApkSystemDownloadActive,
  runAndroidSystemApkDownloadFlow,
} from '../../lib/androidApkInstallFlow';
import styles from '../appUpdate/AppUpdateGate.module.css';

/** Globaler Hinweis: Update via Android DownloadManager — ohne REQUEST_INSTALL_PACKAGES. */
export function AndroidApkUpdateAvailableBanner() {
  const ctx = useAndroidApkUpdateOptional();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemDownloadActive, setSystemDownloadActive] = useState(false);

  const offeredCode = ctx?.manifest?.versionCode;

  useEffect(() => {
    if (ctx?.installKind !== 'android' || typeof offeredCode !== 'number') {
      setSystemDownloadActive(false);
      return;
    }
    let cancelled = false;
    void isAndroidApkSystemDownloadActive(offeredCode).then((active) => {
      if (!cancelled) setSystemDownloadActive(active);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx?.installKind, offeredCode]);

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
  // Während enqueue: Banner aus (wie Wartung bei installBusy).
  // Nach Start: Statusbanner ohne zweite Installationsaktion.
  if (manifest == null) return null;
  if (!visibilityEval.shouldShow && !systemDownloadActive) return null;
  if (!visibilityEval.shouldShow && busy) return null;

  const versionLabel =
    (manifest.latestVersion ?? '').trim() ||
    (typeof manifest.versionCode === 'number' ? `Build ${manifest.versionCode}` : '—');
  const releaseNotes = (manifest.releaseNotes ?? '').trim();
  const showStatusOnly = systemDownloadActive && !busy;

  const handleLater = () => {
    ctx.snoozeCurrentManifest();
  };

  const handleInstallClick = async () => {
    if (busy || systemDownloadActive) return;
    if (!visibilityEval.shouldShow) return;
    setError(null);
    setBusy(true);
    try {
      const res = await runAndroidSystemApkDownloadFlow(manifest);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSystemDownloadActive(true);
    } finally {
      setBusy(false);
    }
  };

  const handleInstallKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void handleInstallClick();
    }
  };

  return (
    <div className={styles.optionalBanner} role="region" aria-label="Android App-Update verfügbar">
      <div className={styles.bannerText}>
        <strong className={styles.bannerTitle}>
          {showStatusOnly
            ? 'Update wird heruntergeladen'
            : `Neue Version verfügbar: ${versionLabel}`}
        </strong>
        <span className={styles.bannerSubtitle}>
          {showStatusOnly
            ? 'Android benachrichtigt dich, sobald die Installation möglich ist. Tippe dann auf die Download-Benachrichtigung.'
            : 'Tippe auf „Jetzt installieren“, um den Android-Systemdownload zu starten.'}
        </span>
        {!showStatusOnly && releaseNotes ? (
          <span className={styles.bannerNotes}>{releaseNotes}</span>
        ) : null}
        {error != null ? <span className={styles.bannerError}>{error}</span> : null}
      </div>
      <div className={styles.bannerActions}>
        {!showStatusOnly ? (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void handleInstallClick()}
            onKeyDown={handleInstallKeyDown}
            disabled={busy}
            aria-busy={busy ? 'true' : 'false'}
            aria-label="Update über Android DownloadManager starten"
          >
            {busy ? 'Update wird heruntergeladen' : 'Jetzt installieren'}
          </button>
        ) : null}
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
