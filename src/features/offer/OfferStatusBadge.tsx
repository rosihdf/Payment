import { OFFER_STATUS_LABELS, type OfferStatus } from '../../domain/offer/offer';
import styles from './OfferStatusBadge.module.css';

interface OfferStatusBadgeProps {
  status: OfferStatus;
}

export function OfferStatusBadge({ status }: OfferStatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {OFFER_STATUS_LABELS[status]}
    </span>
  );
}
