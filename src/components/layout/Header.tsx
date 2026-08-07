import { OnlineIndicator } from '../feedback/OnlineIndicator';
import { RoleSwitcher } from '../navigation/RoleSwitcher';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { APP_DISPLAY_NAME } from '../../utils/appInfo';
import styles from './Header.module.css';

export function Header() {
  const isOnline = useOnlineStatus();

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img
          className={styles.logo}
          src="/branding/amrtech-payment-logo.svg"
          alt=""
          width={40}
          height={40}
          decoding="async"
        />
        <div>
          <p className={styles.appName}>{APP_DISPLAY_NAME}</p>
          <p className={styles.tagline}>Außendienst & Payment-Vergleich</p>
        </div>
      </div>
      <div className={styles.actions}>
        <OnlineIndicator isOnline={isOnline} compact />
        <RoleSwitcher />
      </div>
    </header>
  );
}
