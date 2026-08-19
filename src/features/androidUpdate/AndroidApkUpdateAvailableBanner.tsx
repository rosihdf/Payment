import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { evaluateAndroidApkUpdateBannerVisibility } from '../../lib/androidApkUpdateBanner';
import {
  openAndroidDownloadsFileManagerAgain,
  runAndroidNativeApkSystemHandoffFlow,
} from '../../lib/androidApkSystemHandoffFlow';
import styles from './AndroidApkUpdateAvailableBanner.module.css';

/** Globaler Hinweis unter der Kopfzeile: natives Android-APK-Update nach latest.json. */
export function AndroidApkUpdateAvailableBanner() {
  const ctx = useAndroidApkUpdateOptional();

  const [installBusy, setInstallBusy] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const [showOpenDownloads, setShowOpenDownloads] = useState(false);

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
            installBusy: installBusy,
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
  const headline = `Neue ArioSales-Version verfügbar: ${headlineVersionLabel}`;

  const handleLater = () => {
    ctx.snoozeCurrentManifest();
  };

  const handleUpdateClick = async () => {
    if (!visibilityEval.shouldShow || installBusy) return;
    setInstallError(null);
    setInstallNotice(null);
    setShowOpenDownloads(false);
    setInstallBusy(true);
    try {
      const res = await runAndroidNativeApkSystemHandoffFlow(manifest);
      if (res.ok) {
        setInstallNotice(res.notice);
        setShowOpenDownloads(!res.fileManagerOpened);
      } else {
        setInstallError(res.message);
      }
    } finally {
      setInstallBusy(false);
    }
  };

  const handleOpenDownloads = async () => {
    setInstallError(null);
    const res = await openAndroidDownloadsFileManagerAgain();
    if (!res.ok) {
      setInstallError(res.message);
      return;
    }
    setShowOpenDownloads(false);
  };

  const handleUpdateKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void handleUpdateClick();
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
            Update installieren, um die neueste Version zu nutzen.
            {manifest.mandatory ? ' Dieses Update ist als verbindlich markiert.' : null}
          </p>
          {installNotice != null ? (
            <p className={styles.notice} role="status">
              {installNotice}
            </p>
          ) : null}
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
            onClick={() => void handleUpdateClick()}
            onKeyDown={handleUpdateKeyDown}
            disabled={installBusy}
            aria-busy={installBusy ? 'true' : 'false'}
            className={styles.primaryButton}
            aria-label="Update installieren"
          >
            {installBusy ? 'Update wird heruntergeladen …' : 'Update installieren'}
          </button>
          {showOpenDownloads ? (
            <button
              type="button"
              onClick={() => void handleOpenDownloads()}
              className={styles.secondaryButton}
              aria-label="Downloads öffnen"
            >
              Downloads öffnen
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLater}
              disabled={installBusy}
              className={styles.secondaryButton}
              aria-label="Update-Hinweis für diese Version ausblenden"
            >
              Später
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
