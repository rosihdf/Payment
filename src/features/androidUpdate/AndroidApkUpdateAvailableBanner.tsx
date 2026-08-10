import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { evaluateAndroidApkUpdateBannerVisibility } from '../../lib/androidApkUpdateBanner';
import { runAndroidNativeApkInstallFlow } from '../../lib/androidApkInstallFlow';
import styles from './AndroidApkUpdateAvailableBanner.module.css';

/** Globaler Hinweis unter der Kopfzeile: natives Android-APK-Update nach latest.json. */
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

  useEffect(() => {
    if (!import.meta.env.DEV || ctx == null || ctx.installKind !== 'android') return;
    console.warn('[AmrPayUpdateBanner]', {
      manifestVersionCode: ctx.manifest?.versionCode ?? null,
      shouldShowBanner: visibilityEval.shouldShow,
      reasonWhenFalse: visibilityEval.reasonIfHidden ?? null,
    });
  }, [ctx, visibilityEval.shouldShow, visibilityEval.reasonIfHidden]);

  if (ctx == null || ctx.installKind !== 'android') {
    return null;
  }

  const { manifest } = ctx;

  if (!visibilityEval.shouldShow || manifest == null) {
    return null;
  }

  const headlineVersionLabel =
    (manifest.latestVersion ?? '').trim() || `Build ${manifest.versionCode ?? '—'}`;
  const headline = `Neue AMRtech-Payment-Version verfügbar: ${headlineVersionLabel}`;

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
    <div
      role="region"
      aria-label="Android App-Update verfügbar"
      className={styles.banner}
      data-testid="android-apk-update-available-banner"
    >
      <div className={styles.inner}>
        <div className={styles.textBlock}>
          <p className={styles.headline}>{headline}</p>
          <p className={styles.subline}>
            Update herunterladen, um die neueste Version zu nutzen.
            {manifest.mandatory ? ' Dieses Update ist als verbindlich markiert.' : null}
          </p>
          {installError != null ? (
            <p className={styles.error} role="alert">
              {installError}
            </p>
          ) : null}
          <Link to="/profile" className={styles.detailsLink} aria-label="Details zum App-Update im Profil">
            Details
          </Link>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => void handleInstallClick()}
            onKeyDown={handleInstallKeyDown}
            disabled={installBusy}
            aria-busy={installBusy ? 'true' : 'false'}
            className={styles.primaryButton}
            aria-label="Update herunterladen und Paketinstaller öffnen"
          >
            {installBusy ? 'Wird heruntergeladen …' : 'Update herunterladen'}
          </button>
          <button
            type="button"
            onClick={handleLater}
            disabled={installBusy}
            className={styles.secondaryButton}
            aria-label="Update-Hinweis für diese Version ausblenden"
          >
            Später
          </button>
        </div>
      </div>
    </div>
  );
}
