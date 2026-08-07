import { useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { evaluateAndroidApkUpdateBannerVisibility } from '../../lib/androidApkUpdateBanner';
import { runAndroidNativeApkInstallFlow } from '../../lib/androidApkInstallFlow';
import styles from '../appUpdate/AppUpdateGate.module.css';

/** Globaler Hinweis: natives Android-APK-Update — 1:1 Wartungslogik, Payment-Texte. */
export function AndroidApkUpdateAvailableBanner() {
  const ctx = useAndroidApkUpdateOptional();
  const [installBusy, setInstallBusy] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

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
            installBusy,
          },
    [ctx, installBusy],
  );

  const visibilityEval = useMemo(
    () =>
      bannerInput == null
        ? { shouldShow: false as const, reasonIfHidden: 'no_provider' as const }
        : evaluateAndroidApkUpdateBannerVisibility(bannerInput),
    [bannerInput],
  );

  if (ctx == null || ctx.installKind !== 'android') {
    return null;
  }

  const { manifest } = ctx;
  if (!visibilityEval.shouldShow || manifest == null) {
    return null;
  }

  const headlineVersionLabel =
    (manifest.latestVersion ?? '').trim() || `Build ${manifest.versionCode ?? '—'}`;

  const handleLater = () => {
    ctx.snoozeCurrentManifest();
  };

  const handleInstallClick = async () => {
    if (!visibilityEval.shouldShow || installBusy) return;
    setInstallError(null);
    setInstallBusy(true);
    try {
      const res = await runAndroidNativeApkInstallFlow(manifest);
      if (!res.ok) {
        setInstallError(res.message);
      }
    } finally {
      setInstallBusy(false);
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
          Neue AMRtech-Payment-Version verfügbar: {headlineVersionLabel}
        </strong>
        <span className={styles.bannerSubtitle}>
          Update installieren, um die neuesten Verbesserungen zu nutzen.
        </span>
        {installError != null ? <span className={styles.bannerError}>{installError}</span> : null}
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
          disabled={installBusy}
          aria-busy={installBusy ? 'true' : 'false'}
          aria-label="Update installieren: interner Download und Paketinstaller"
        >
          {installBusy ? 'Wird vorbereitet …' : 'Jetzt aktualisieren'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleLater}
          disabled={installBusy}
          aria-label="Update-Hinweis für diese Version ausblenden"
        >
          Später
        </button>
      </div>
    </div>
  );
}
