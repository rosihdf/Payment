import { useState } from 'react';
import { useAppUpdate } from '../../app/providers/AppUpdateProvider';
import { APP_DISPLAY_NAME } from '../../utils/appInfo';
import styles from './AppUpdateGate.module.css';

export function AppUpdateBanner() {
  const { snapshot, openDownload, dismissOptional, shouldShowOptionalBanner } = useAppUpdate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!shouldShowOptionalBanner || !snapshot.manifest) {
    return null;
  }

  const manifest = snapshot.manifest;

  return (
    <div className={styles.optionalBanner} role="status" aria-live="polite">
      <div className={styles.bannerText}>
        <strong className={styles.bannerTitle}>Neue Version verfügbar</strong>
        <span className={styles.bannerVersion}>Version {manifest.versionName}</span>
        <span className={styles.bannerSubtitle}>
          Eine neue Version von {APP_DISPLAY_NAME} steht bereit.
        </span>
        {manifest.releaseNotes ? (
          <span className={styles.bannerNotes}>{manifest.releaseNotes}</span>
        ) : null}
        {error ? <span className={styles.bannerError}>{error}</span> : null}
      </div>
      <div className={styles.bannerActions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void openDownload()
              .then((result) => {
                if (!result.ok) {
                  setError(result.error);
                }
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? 'Wird geöffnet…' : 'Jetzt installieren'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={busy}
          onClick={dismissOptional}
        >
          Später
        </button>
      </div>
    </div>
  );
}
