import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.icon} aria-hidden="true">
        ○
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
