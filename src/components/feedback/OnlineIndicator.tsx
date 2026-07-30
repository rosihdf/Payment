import styles from './OnlineIndicator.module.css';

interface OnlineIndicatorProps {
  isOnline: boolean;
  compact?: boolean;
}

export function OnlineIndicator({ isOnline, compact = false }: OnlineIndicatorProps) {
  return (
    <div
      className={`${styles.indicator} ${isOnline ? styles.online : styles.offline}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>
        {compact ? (isOnline ? 'Online' : 'Offline') : isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
