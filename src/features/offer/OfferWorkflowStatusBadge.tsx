import {
  OFFER_WORKFLOW_STATUS_LABELS,
  type OfferWorkflowStatus,
} from '../../domain/offer/offerWorkflow';
import styles from './OfferWorkflowStatusBadge.module.css';

interface OfferWorkflowStatusBadgeProps {
  status: OfferWorkflowStatus;
}

export function OfferWorkflowStatusBadge({ status }: OfferWorkflowStatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[status] ?? ''}`}>
      {OFFER_WORKFLOW_STATUS_LABELS[status]}
    </span>
  );
}
