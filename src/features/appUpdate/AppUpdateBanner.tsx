import { useAppUpdate } from '../../app/providers/AppUpdateProvider';
import { APP_DISPLAY_NAME } from '../../utils/appInfo';
import { formatBytes } from '../../utils/format';
import styles from './AppUpdateGate.module.css';

function progressLabel(snapshot: ReturnType<typeof useAppUpdate>['snapshot']): string {
  const pct = snapshot.downloadProgress ?? 0;
  const received = snapshot.downloadBytesReceived;
  const total = snapshot.downloadBytesTotal;
  if (received != null && total != null && total > 0) {
    return `Update wird heruntergeladen – ${pct} % (${formatBytes(received)} / ${formatBytes(total)})`;
  }
  return `Update wird heruntergeladen – ${pct} %`;
}

export function AppUpdateBanner() {
  const {
    snapshot,
    startInstall,
    openInstaller,
    cancelDownload,
    dismissOptional,
    shouldShowOptionalBanner,
    shouldShowBannerLaterAction,
  } = useAppUpdate();

  if (!shouldShowOptionalBanner || !snapshot.manifest) {
    return null;
  }

  const manifest = snapshot.manifest;
  const busy =
    snapshot.status === 'downloading' ||
    snapshot.status === 'verifying' ||
    snapshot.status === 'installing' ||
    snapshot.status === 'checking';

  return (
    <div className={styles.optionalBanner} role="status" aria-live="polite">
      <div className={styles.bannerText}>
        <strong className={styles.bannerTitle}>
          Neue Version verfügbar
          {snapshot.developerModeEnabled && snapshot.updateChannel === 'test' ? (
            <span className={styles.testBadge}> TEST</span>
          ) : null}
        </strong>
        <span className={styles.bannerVersion}>Version {manifest.versionName}</span>
        <span className={styles.bannerSubtitle}>
          Eine neue Version von {APP_DISPLAY_NAME} steht bereit.
        </span>
        {manifest.releaseNotes ? (
          <span className={styles.bannerNotes}>{manifest.releaseNotes}</span>
        ) : null}

        {snapshot.status === 'downloading' ? (
          <>
            <span className={styles.bannerNotes}>{progressLabel(snapshot)}</span>
            <progress
              className={styles.progress}
              max={100}
              value={snapshot.downloadProgress ?? 0}
            />
          </>
        ) : null}
        {snapshot.status === 'verifying' ? (
          <span className={styles.bannerNotes}>Download wird überprüft …</span>
        ) : null}
        {snapshot.status === 'installing' ? (
          <span className={styles.bannerNotes}>Installation wird vorbereitet …</span>
        ) : null}
        {snapshot.status === 'readyToInstall' ? (
          <span className={styles.bannerNotes}>Update ist bereit zur Installation</span>
        ) : null}
        {snapshot.errorMessage ? (
          <span className={styles.bannerError}>{snapshot.errorMessage}</span>
        ) : null}
      </div>

      <div className={styles.bannerActions}>
        {snapshot.status === 'downloading' ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              void cancelDownload();
            }}
          >
            Abbrechen
          </button>
        ) : null}

        {snapshot.status === 'readyToInstall' ? (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={busy}
            onClick={() => {
              void openInstaller();
            }}
          >
            Installation starten
          </button>
        ) : null}

        {snapshot.status === 'available' || snapshot.status === 'error' ? (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={busy}
            onClick={() => {
              void startInstall();
            }}
          >
            {snapshot.status === 'error' ? 'Erneut versuchen' : 'Jetzt installieren'}
          </button>
        ) : null}

        {shouldShowBannerLaterAction ? (
          <button type="button" className={styles.secondaryButton} onClick={dismissOptional}>
            Später
          </button>
        ) : null}
      </div>
    </div>
  );
}
