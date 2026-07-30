import { Link } from 'react-router-dom';
import type { OfferDocument } from '../../domain/offerDocument/offerDocument';
import { displayDateTime } from '../../utils/format';
import { OfferDocumentStatusBadge } from './OfferDocumentStatusBadge';
import styles from './OfferDocumentCard.module.css';

interface OfferDocumentCardProps {
  document: OfferDocument;
  offerId: string;
  onDownload: (documentId: string) => void;
  isDownloading?: boolean;
}

export function OfferDocumentCard({
  document,
  offerId,
  onDownload,
  isDownloading = false,
}: OfferDocumentCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div>
          <Link
            className={styles.titleLink}
            to={`/offers/${offerId}/documents/${document.id}`}
          >
            <h3 className={styles.title}>{document.documentNumber}</h3>
          </Link>
          <p className={styles.meta}>Version {document.version}</p>
        </div>
        <OfferDocumentStatusBadge status={document.status} />
      </div>

      <dl className={styles.details}>
        <div className={styles.row}>
          <dt>Erzeugt am</dt>
          <dd>{displayDateTime(document.createdAt)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Erzeugt von</dt>
          <dd>{document.snapshot.generatedByDisplayName}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <Link
          className={styles.secondaryAction}
          to={`/offers/${offerId}/documents/${document.id}`}
        >
          Details anzeigen
        </Link>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={isDownloading}
          onClick={() => onDownload(document.id)}
        >
          PDF herunterladen
        </button>
      </div>
    </article>
  );
}
