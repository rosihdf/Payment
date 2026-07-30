import {
  OFFER_DOCUMENT_STATUS_LABELS,
  type OfferDocumentStatus,
} from '../../domain/offerDocument/offerDocument';
import styles from './OfferDocumentStatusBadge.module.css';

interface OfferDocumentStatusBadgeProps {
  status: OfferDocumentStatus;
}

export function OfferDocumentStatusBadge({ status }: OfferDocumentStatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {OFFER_DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}
