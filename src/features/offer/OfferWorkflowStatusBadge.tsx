import type { OfferWorkflowStatus } from '../../domain/offer/offerWorkflow';
import {
  getOfferWorkflowDisplayGroup,
  getOfferWorkflowDisplayLabel,
  getOfferWorkflowTechnicalLabel,
} from './offerWorkflowDisplay';
import styles from './OfferWorkflowStatusBadge.module.css';

interface OfferWorkflowStatusBadgeProps {
  status: OfferWorkflowStatus;
  /** Technischen Status klein mit anzeigen (z. B. Admin). */
  showTechnical?: boolean;
}

export function OfferWorkflowStatusBadge({ status, showTechnical = false }: OfferWorkflowStatusBadgeProps) {
  const group = getOfferWorkflowDisplayGroup(status);
  return (
    <span className={`${styles.badge} ${styles[group] ?? ''}`} data-status={status} data-group={group}>
      <span>{getOfferWorkflowDisplayLabel(status)}</span>
      {showTechnical ? (
        <span className={styles.technical}> · {getOfferWorkflowTechnicalLabel(status)}</span>
      ) : null}
    </span>
  );
}
