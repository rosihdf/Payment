import type { ReactNode } from 'react';
import styles from './StatusBadge.module.css';

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label: string;
  technicalLabel?: string;
  className?: string;
}

const VARIANT_CLASS: Record<StatusBadgeVariant, string> = {
  success: styles.success ?? '',
  warning: styles.warning ?? '',
  danger: styles.danger ?? '',
  neutral: styles.neutral ?? '',
  info: styles.info ?? '',
};

export function StatusBadge({ variant, label, technicalLabel, className }: StatusBadgeProps) {
  const classNames = [styles.badge, VARIANT_CLASS[variant], className].filter(Boolean).join(' ');

  return (
    <span className={classNames}>
      {label}
      {technicalLabel ? (
        <span className={styles.technical} aria-label={`Technischer Status: ${technicalLabel}`}>
          {technicalLabel}
        </span>
      ) : null}
    </span>
  );
}

export function statusBadgeFromVariant(variant: StatusBadgeVariant, label: string): ReactNode {
  return <StatusBadge variant={variant} label={label} />;
}
