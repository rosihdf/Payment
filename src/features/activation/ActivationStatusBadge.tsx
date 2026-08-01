import type { ActivationStatus } from '../../domain/activation/activationStatus';
import {
  getActivationDisplayGroup,
  getActivationDisplayLabel,
  getActivationTechnicalLabel,
} from './activationStatusDisplay';
import styles from './ActivationStatusBadge.module.css';

export function ActivationStatusBadge({
  status,
  showTechnical = false,
}: {
  status: ActivationStatus;
  showTechnical?: boolean;
}) {
  const group = getActivationDisplayGroup(status);
  return (
    <span className={styles.badge} data-status={status} data-group={group}>
      {getActivationDisplayLabel(status)}
      {showTechnical ? (
        <span className={styles.technical}> · {getActivationTechnicalLabel(status)}</span>
      ) : null}
    </span>
  );
}
