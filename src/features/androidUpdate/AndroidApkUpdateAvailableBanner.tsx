import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAndroidApkUpdateOptional } from '../../context/AndroidApkUpdateProvider';
import { evaluateAndroidApkUpdateBannerVisibility } from '../../lib/androidApkUpdateBanner';
import { openAndroidUpdateDownloadExternally } from '../../lib/androidApkUpdateHandoff';
import styles from './AndroidApkUpdateAvailableBanner.module.css';

/** Globaler Hinweis unter der Kopfzeile: natives Android-APK-Update nach latest.json. */
export function AndroidApkUpdateAvailableBanner() {
  const ctx = useAndroidApkUpdateOptional();

  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);

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
            installBusy: handoffBusy,
          },
    [ctx, handoffBusy],
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

  const handleUpdateClick = async () => {
    if (!visibilityEval.shouldShow || handoffBusy) return;
    setHandoffError(null);
    setHandoffNotice(null);
    setHandoffBusy(true);
    try {
      const res = await openAndroidUpdateDownloadExternally(manifest);
      if (res.ok) {
        setHandoffNotice(res.notice);
      } else {
        setHandoffError(res.message);
      }
    } finally {
      setHandoffBusy(false);
    }
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
          {handoffNotice != null ? (
            <p className={styles.notice} role="status">
              {handoffNotice}
            </p>
          ) : null}
          {handoffError != null ? (
            <p className={styles.error} role="alert">
              {handoffError}
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
            disabled={handoffBusy}
            aria-busy={handoffBusy ? 'true' : 'false'}
            className={styles.primaryButton}
            aria-label="Update im Browser öffnen"
          >
            {handoffBusy ? 'Wird geöffnet …' : 'Update installieren'}
          </button>
          <button
            type="button"
            onClick={handleLater}
            disabled={handoffBusy}
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
