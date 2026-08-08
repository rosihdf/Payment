import { useState, type KeyboardEvent } from 'react';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { evaluateAndroidApkUpdateBannerVisibility } from '../../lib/androidApkUpdateBanner';
import { runAndroidNativeApkInstallFlow } from '../../lib/androidApkInstallFlow';
import styles from '../appUpdate/AppUpdateGate.module.css';

/** Globaler Hinweis: Update via App-Cache + FileProvider — ohne REQUEST_INSTALL_PACKAGES. */
export function AndroidApkUpdateAvailableBanner() {
  const ctx = useAndroidApkUpdateOptional();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  if (manifest == null) return null;
  if (!visibilityEval.shouldShow && !busy) return null;

  const versionLabel =
    (manifest.latestVersion ?? '').trim() ||
    (typeof manifest.versionCode === 'number' ? `Build ${manifest.versionCode}` : '—');
  const releaseNotes = (manifest.releaseNotes ?? '').trim();

  const handleLater = () => {
    ctx.snoozeCurrentManifest();
  };

  const handleInstallClick = async () => {
    if (busy) return;
    if (!visibilityEval.shouldShow) return;
    setError(null);
    setBusy(true);
    try {
      const res = await runAndroidNativeApkInstallFlow(manifest);
      if (!res.ok) {
        setError(res.message);
      }
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
          {busy
            ? 'Update wird heruntergeladen'
            : `Neue Version verfügbar: ${versionLabel}`}
        </strong>
        <span className={styles.bannerSubtitle}>
          {busy
            ? 'Bitte warten — anschließend öffnet der Android-Systeminstaller.'
            : 'Tippe auf „Jetzt installieren“, um das Update herunterzuladen und zu installieren.'}
        </span>
        {!busy && releaseNotes ? (
          <span className={styles.bannerNotes}>{releaseNotes}</span>
        ) : null}
        {error != null ? <span className={styles.bannerError}>{error}</span> : null}
      </div>
      <div className={styles.bannerActions}>
        {!busy ? (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void handleInstallClick()}
            onKeyDown={handleInstallKeyDown}
            disabled={busy}
            aria-busy="false"
            aria-label="Update herunterladen und Systeminstaller öffnen"
          >
            Jetzt installieren
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryButton}
            disabled
            aria-busy="true"
            aria-label="Update wird heruntergeladen"
          >
            Update wird heruntergeladen
          </button>
        )}
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
