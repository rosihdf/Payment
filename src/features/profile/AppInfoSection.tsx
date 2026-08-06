import { useState } from 'react';
import { useAppUpdate } from '../../app/providers/AppUpdateProvider';
import { APP_DISPLAY_NAME } from '../../utils/appInfo';
import { formatBytes, formatDateTime } from '../../utils/format';
import styles from './ProfilePage.module.css';

const STATUS_LABELS: Record<string, string> = {
  checking: 'Prüfung läuft…',
  current: 'Aktuell',
  available: 'Update verfügbar',
  mandatory: 'Pflichtupdate',
  offline: 'Offline',
  error: 'Fehler',
};

export function AppInfoSection() {
  const { snapshot, checkNow, openDownload, dismissOptional } = useAppUpdate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const manifest = snapshot.manifest;
  const canDownload = snapshot.status === 'available' || snapshot.status === 'mandatory';
  const canDismissLater = snapshot.status === 'available';

  return (
    <section className={styles.adminSection} aria-labelledby="app-info-title">
      <h2 id="app-info-title" className={styles.adminTitle}>
        App-Info
      </h2>
      <dl className={styles.details}>
        <div className={styles.row}>
          <dt>App</dt>
          <dd>{APP_DISPLAY_NAME}</dd>
        </div>
        <div className={styles.row}>
          <dt>Installierte Version</dt>
          <dd>{snapshot.installedVersionName}</dd>
        </div>
        <div className={styles.row}>
          <dt>Buildnummer</dt>
          <dd>{snapshot.installedVersionCode}</dd>
        </div>
        <div className={styles.row}>
          <dt>Letzte Updateprüfung</dt>
          <dd>
            {snapshot.lastCheckedAt ? formatDateTime(snapshot.lastCheckedAt) : 'Noch nicht geprüft'}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>Update-Status</dt>
          <dd>{STATUS_LABELS[snapshot.status] ?? snapshot.status}</dd>
        </div>
        {manifest ? (
          <>
            <div className={styles.row}>
              <dt>Verfügbare Version</dt>
              <dd>
                {manifest.versionName} (Build {manifest.versionCode})
              </dd>
            </div>
            <div className={styles.row}>
              <dt>Dateigröße</dt>
              <dd>{formatBytes(manifest.sizeBytes)}</dd>
            </div>
            <div className={styles.row}>
              <dt>Veröffentlichungsdatum</dt>
              <dd>{formatDateTime(manifest.publishedAt)}</dd>
            </div>
            <div className={styles.row}>
              <dt>Release Notes</dt>
              <dd>{manifest.releaseNotes}</dd>
            </div>
            <div className={styles.row}>
              <dt>SHA-256</dt>
              <dd className={styles.mono}>{manifest.sha256}</dd>
            </div>
          </>
        ) : null}
        {snapshot.errorMessage ? (
          <div className={styles.row}>
            <dt>Hinweis</dt>
            <dd>{snapshot.errorMessage}</dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.appInfoActions}>
        <button
          type="button"
          className={styles.adminLink}
          disabled={busy || snapshot.status === 'checking'}
          onClick={() => {
            setBusy(true);
            setMessage(null);
            void checkNow()
              .then((next) => {
                setMessage(
                  next.status === 'current'
                    ? 'Die App ist aktuell'
                    : next.status === 'available' || next.status === 'mandatory'
                      ? 'Update verfügbar'
                      : next.errorMessage ?? 'Prüfung abgeschlossen.',
                );
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy || snapshot.status === 'checking' ? 'Prüfe…' : 'Jetzt prüfen'}
        </button>

        {canDownload ? (
          <button
            type="button"
            className={styles.adminLink}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setMessage(null);
              void openDownload()
                .then((result) => {
                  setMessage(
                    result.ok
                      ? 'Download geöffnet. Bitte Installation selbst bestätigen.'
                      : result.error,
                  );
                })
                .finally(() => setBusy(false));
            }}
          >
            Update herunterladen
          </button>
        ) : null}

        {canDismissLater ? (
          <button type="button" className={styles.adminLink} onClick={dismissOptional}>
            Später
          </button>
        ) : null}
      </div>

      {message ? <p className={styles.appInfoMessage}>{message}</p> : null}

      {!snapshot.isNativeAndroid ? (
        <p className={styles.appInfoMessage}>
          Im Browser bzw. als PWA entfällt die native APK-Updateprüfung. Updates der Web-App
          übernimmt der Service Worker.
        </p>
      ) : null}
    </section>
  );
}
