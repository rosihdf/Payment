import { useAppUpdate } from '../../app/providers/AppUpdateProvider';
import { APP_DISPLAY_NAME } from '../../utils/appInfo';
import { formatBytes, formatDateTime } from '../../utils/format';
import styles from './ProfilePage.module.css';

function statusLabel(snapshot: ReturnType<typeof useAppUpdate>['snapshot']): string {
  switch (snapshot.status) {
    case 'idle':
      return 'Noch nicht geprüft';
    case 'checking':
      return 'Update wird geprüft …';
    case 'current':
      return 'Die App ist aktuell';
    case 'available':
    case 'mandatory':
      return 'Neue Version verfügbar';
    case 'downloading':
      return 'Update wird heruntergeladen';
    case 'verifying':
      return 'Download wird überprüft …';
    case 'readyToInstall':
      return 'Update ist bereit zur Installation';
    case 'installing':
      return 'Installation wird vorbereitet …';
    case 'offline':
      return 'Keine Internetverbindung';
    case 'error':
      return snapshot.errorMessage ?? 'Fehler';
    default:
      return snapshot.status;
  }
}

export function AppInfoSection() {
  const {
    snapshot,
    checkNow,
    startInstall,
    openInstaller,
    cancelDownload,
    openUnknownSourcesSettings,
    openBrowserFallback,
  } = useAppUpdate();

  const manifest = snapshot.manifest;
  const hasOffer =
    snapshot.status === 'available' ||
    snapshot.status === 'mandatory' ||
    snapshot.status === 'readyToInstall' ||
    snapshot.status === 'downloading' ||
    snapshot.status === 'verifying' ||
    snapshot.status === 'installing' ||
    (snapshot.status === 'error' && Boolean(manifest));

  const showCheckFirst = snapshot.status === 'idle';
  const showRecheck =
    snapshot.status === 'current' ||
    snapshot.status === 'available' ||
    snapshot.status === 'mandatory' ||
    snapshot.status === 'readyToInstall' ||
    snapshot.status === 'error' ||
    snapshot.status === 'offline';
  const checking = snapshot.status === 'checking';
  const downloading = snapshot.status === 'downloading';
  const verifying = snapshot.status === 'verifying';
  const installing = snapshot.status === 'installing';
  const busy = checking || downloading || verifying || installing;

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
          <dd>{statusLabel(snapshot)}</dd>
        </div>
        {hasOffer && manifest ? (
          <>
            <div className={styles.row}>
              <dt>Verfügbare Version</dt>
              <dd>
                {manifest.versionName} (Build {manifest.versionCode})
              </dd>
            </div>
            {manifest.releaseNotes ? (
              <div className={styles.row}>
                <dt>Release Notes</dt>
                <dd>{manifest.releaseNotes}</dd>
              </div>
            ) : null}
            <div className={styles.row}>
              <dt>Dateigröße</dt>
              <dd>{formatBytes(manifest.sizeBytes)}</dd>
            </div>
          </>
        ) : null}
        {downloading ? (
          <div className={styles.row}>
            <dt>Fortschritt</dt>
            <dd>
              {snapshot.downloadProgress ?? 0} %
              {snapshot.downloadBytesReceived != null && snapshot.downloadBytesTotal != null
                ? ` (${formatBytes(snapshot.downloadBytesReceived)} / ${formatBytes(snapshot.downloadBytesTotal)})`
                : ''}
              <progress
                max={100}
                value={snapshot.downloadProgress ?? 0}
                style={{ display: 'block', width: '100%', marginTop: '0.5rem' }}
              />
            </dd>
          </div>
        ) : null}
        {snapshot.errorMessage && snapshot.status === 'error' ? (
          <div className={styles.row}>
            <dt>Hinweis</dt>
            <dd>{snapshot.errorMessage}</dd>
          </div>
        ) : null}
        {snapshot.needsUnknownSourcesPermission ? (
          <div className={styles.row}>
            <dt>Hinweis</dt>
            <dd>
              Android blockiert die Installation aus dieser Quelle. Bitte erlauben und danach
              Installation starten.
            </dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.appInfoActions}>
        {showCheckFirst ? (
          <button
            type="button"
            className={styles.adminLink}
            disabled={busy || !snapshot.isNativeAndroid}
            onClick={() => {
              void checkNow();
            }}
          >
            Jetzt prüfen
          </button>
        ) : null}

        {hasOffer && (snapshot.status === 'available' || snapshot.status === 'mandatory') ? (
          <button
            type="button"
            className={styles.adminLink}
            disabled={busy}
            onClick={() => {
              void startInstall();
            }}
          >
            Jetzt installieren
          </button>
        ) : null}

        {snapshot.status === 'readyToInstall' ? (
          <button
            type="button"
            className={styles.adminLink}
            disabled={busy}
            onClick={() => {
              void openInstaller();
            }}
          >
            Installation starten
          </button>
        ) : null}

        {snapshot.status === 'error' && manifest ? (
          <button
            type="button"
            className={styles.adminLink}
            disabled={busy}
            onClick={() => {
              void startInstall();
            }}
          >
            Erneut versuchen
          </button>
        ) : null}

        {downloading ? (
          <button
            type="button"
            className={styles.adminLink}
            onClick={() => {
              void cancelDownload();
            }}
          >
            Abbrechen
          </button>
        ) : null}

        {snapshot.needsUnknownSourcesPermission ? (
          <button
            type="button"
            className={styles.adminLink}
            onClick={() => {
              void openUnknownSourcesSettings();
            }}
          >
            Einstellungen öffnen
          </button>
        ) : null}

        {showRecheck && !showCheckFirst && !downloading && !verifying && !installing ? (
          <button
            type="button"
            className={styles.adminLink}
            disabled={busy || !snapshot.isNativeAndroid}
            onClick={() => {
              void checkNow();
            }}
          >
            Erneut prüfen
          </button>
        ) : null}

        {snapshot.status === 'error' && manifest ? (
          <button
            type="button"
            className={styles.adminLink}
            onClick={() => {
              openBrowserFallback();
            }}
          >
            Im Browser öffnen
          </button>
        ) : null}
      </div>

      {!snapshot.isNativeAndroid ? (
        <p className={styles.appInfoMessage}>
          Im Browser bzw. als PWA entfällt die native APK-Updateprüfung. Updates der Web-App
          übernimmt der Service Worker.
        </p>
      ) : null}
    </section>
  );
}
