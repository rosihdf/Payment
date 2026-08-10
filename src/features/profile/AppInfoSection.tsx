import { getAppBuildInfo } from '../../lib/appBuildInfo';
import { APP_DISPLAY_NAME } from '../../utils/appInfo';
import { AndroidApkUpdateSettingsCard } from './AndroidApkUpdateSettingsCard';
import styles from './ProfilePage.module.css';

export function AppInfoSection() {
  const info = getAppBuildInfo();
  const installedLabel = `${info.version}${
    info.androidGradleVersionCode != null
      ? ` · APK ${info.androidGradleVersionName || '—'} (#${info.androidGradleVersionCode})`
      : ''
  }`;

  return (
    <section className={styles.appInfo} aria-labelledby="app-info-heading">
      <img
        className={styles.appInfoLogo}
        src="/branding/amrtech-payment-logo.svg"
        alt=""
        width={120}
        height={96}
        decoding="async"
      />
      <h2 id="app-info-heading" className={styles.sectionTitle}>
        App-Info
      </h2>
      <dl className={styles.appInfoList}>
        <div className={styles.row}>
          <dt>App</dt>
          <dd>{APP_DISPLAY_NAME}</dd>
        </div>
        <div className={styles.row}>
          <dt>Version</dt>
          <dd>{installedLabel}</dd>
        </div>
      </dl>
      {info.installKind === 'android' ? <AndroidApkUpdateSettingsCard /> : null}
    </section>
  );
}
