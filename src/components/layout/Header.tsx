import { OnlineIndicator } from '../feedback/OnlineIndicator';
import { RoleSwitcher } from '../navigation/RoleSwitcher';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import styles from './Header.module.css';

export function Header() {
  const isOnline = useOnlineStatus();

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          A
        </span>
        <div>
          <p className={styles.appName}>AMRtech Payment Leads</p>
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
