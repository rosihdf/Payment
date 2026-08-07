import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { evaluateAndroidApkUpdateBannerVisibility } from '../../lib/androidApkUpdateBanner';
import {
  isBlockingDownloadStatus,
  readAndroidApkDownloadState,
} from '../../lib/androidApkDownloadState';
import { runAndroidSystemApkDownloadFlow } from '../../lib/androidApkInstallFlow';
import { AppUpdateDownload } from '../../lib/appUpdateDownload';
import styles from '../appUpdate/AppUpdateGate.module.css';

type BannerPhase = 'idle' | 'starting' | 'started';

/** Globaler Hinweis: Update via Android DownloadManager — ohne REQUEST_INSTALL_PACKAGES. */
export function AndroidApkUpdateAvailableBanner() {
  const ctx = useAndroidApkUpdateOptional();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<BannerPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadActive, setDownloadActive] = useState(false);

  const bannerInput = useMemo(
    () =>
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
          },
    [ctx, busy],
  );

  const visibilityEval = useMemo(
    () =>
      bannerInput == null
        ? { shouldShow: false as const, reasonIfHidden: 'no_provider' as const }
        : evaluateAndroidApkUpdateBannerVisibility(bannerInput),
    [bannerInput],
  );

  useEffect(() => {
    const manifestCode = ctx?.manifest?.versionCode;
    if (typeof manifestCode !== 'number') {
      setDownloadActive(false);
      return;
    }
    const state = readAndroidApkDownloadState();
    if (state == null || state.versionCode !== Math.trunc(manifestCode)) {
      setDownloadActive(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const st = await AppUpdateDownload.getDownloadStatus({ downloadId: state.downloadId });
        if (!cancelled) setDownloadActive(isBlockingDownloadStatus(st.status));
      } catch {
        if (!cancelled) setDownloadActive(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx?.manifest?.versionCode, phase]);

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

  const handleInstallClick = async () => {
    if (!visibilityEval.shouldShow || busy) return;
    setError(null);
    setBusy(true);
    setPhase('starting');
    try {
      const res = await runAndroidSystemApkDownloadFlow(manifest);
      if (!res.ok) {
        setError(res.message);
        setPhase('idle');
        return;
      }
      setPhase('started');
      setDownloadActive(true);
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

  const primaryLabel =
    phase === 'starting' || busy
      ? 'Update wird heruntergeladen'
      : phase === 'started' || downloadActive
        ? 'Download gestartet'
        : 'Jetzt installieren';

  return (
    <div className={styles.optionalBanner} role="region" aria-label="Android App-Update verfügbar">
      <div className={styles.bannerText}>
        <strong className={styles.bannerTitle}>Neue Version verfügbar</strong>
        <span className={styles.bannerSubtitle}>
          {phase === 'started' || downloadActive
            ? 'Android informiert dich, sobald das Update bereit zur Installation ist.'
            : 'Tippe auf „Jetzt installieren“, um den Android-Systemdownload zu starten.'}
        </span>
        {error != null ? <span className={styles.bannerError}>{error}</span> : null}
        <Link to="/profile" className={styles.bannerSubtitle}>
          Details
        </Link>
      </div>
      <div className={styles.bannerActions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void handleInstallClick()}
          onKeyDown={handleInstallKeyDown}
          disabled={busy || phase === 'started' || downloadActive}
          aria-busy={busy ? 'true' : 'false'}
          aria-label="Update über Android DownloadManager starten"
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
