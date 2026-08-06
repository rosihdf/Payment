import { Link, useLocation } from 'react-router-dom';
import { useAppUpdate } from '../../app/providers/AppUpdateProvider';
import { formatBytes, formatDateTime } from '../../utils/format';
import styles from './AppUpdateGate.module.css';

/**
 * Pflichtupdate-Overlay der bestehenden Updatearchitektur.
 * Optionales Banner liegt zentral in der App-Shell unter dem Header.
 */
export function AppUpdateGate({ children }: { children: React.ReactNode }) {
  const { snapshot, openDownload } = useAppUpdate();
  const location = useLocation();
  const onProfile = location.pathname === '/profile';

  const blockApp =
    snapshot.isNativeAndroid && snapshot.status === 'mandatory' && !onProfile;

  if (blockApp && snapshot.manifest) {
    return (
      <div
        className={styles.mandatoryOverlay}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mandatory-update-title"
      >
        <div className={styles.mandatoryCard}>
          <h1 id="mandatory-update-title" className={styles.mandatoryTitle}>
            Pflichtupdate erforderlich
          </h1>
          <p className={styles.mandatoryText}>
            Die installierte Version {snapshot.installedVersionName} (Build{' '}
            {snapshot.installedVersionCode}) muss aktualisiert werden, bevor die App weiter genutzt
            werden kann.
          </p>
          <dl className={styles.meta}>
            <div>
              <dt>Verfügbare Version</dt>
              <dd>{snapshot.manifest.versionName}</dd>
            </div>
            <div>
              <dt>Build</dt>
              <dd>{snapshot.manifest.versionCode}</dd>
            </div>
            <div>
              <dt>Größe</dt>
              <dd>{formatBytes(snapshot.manifest.sizeBytes)}</dd>
            </div>
            <div>
              <dt>Veröffentlicht</dt>
              <dd>{formatDateTime(snapshot.manifest.publishedAt)}</dd>
            </div>
          </dl>
          <p className={styles.notes}>{snapshot.manifest.releaseNotes}</p>
          <p className={styles.hash}>
            SHA-256: <code>{snapshot.manifest.sha256}</code>
          </p>
          <div className={styles.bannerActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                void openDownload();
              }}
            >
              Jetzt installieren
            </button>
            <Link className={styles.secondaryButton} to="/profile">
              App-Info öffnen
            </Link>
          </div>
          <p className={styles.hint}>
            Die Installation muss von Ihnen bestätigt werden. Es gibt keine stille Installation.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
