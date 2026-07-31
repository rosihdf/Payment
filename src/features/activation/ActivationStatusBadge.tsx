import { ACTIVATION_STATUS_LABELS, type ActivationStatus } from '../../domain/activation/activationStatus';
import styles from './ActivationStatusBadge.module.css';

export function ActivationStatusBadge({ status }: { status: ActivationStatus }) {
  return (
    <span className={styles.badge} data-status={status}>
      {ACTIVATION_STATUS_LABELS[status]}
    </span>
  );
}
