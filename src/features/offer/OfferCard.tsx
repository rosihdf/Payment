import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Offer } from '../../domain/offer/offer';
import { calculateOfferTotals } from '../../domain/offer/offerCalculations';
import { getLeadDisplayName } from '../../domain/lead/getLeadDisplayName';
import { formatContactName, formatDate } from '../../utils/format';
import { OfferStatusBadge } from './OfferStatusBadge';
import { OfferTotalsDisplay } from './OfferTotalsDisplay';
import { OfferWorkflowStatusBadge } from './OfferWorkflowStatusBadge';
import styles from './OfferCard.module.css';

interface OfferCardProps {
  offer: Offer;
  actions?: ReactNode;
}

export function OfferCard({ offer, actions }: OfferCardProps) {
  const totals = calculateOfferTotals(offer);
  const contactName = formatContactName(
    offer.customerSnapshot.contactFirstName,
    offer.customerSnapshot.contactLastName,
  );

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div>
          <Link className={styles.titleLink} to={`/offers/${offer.id}`}>
            <h2 className={styles.title}>{offer.title}</h2>
          </Link>
          <p className={styles.number}>{offer.offerNumber}</p>
        </div>
        <div className={styles.badges}>
          <OfferStatusBadge status={offer.status} />
          <OfferWorkflowStatusBadge status={offer.workflowStatus} />
        </div>
      </div>

      <dl className={styles.details}>
        <div className={styles.row}>
          <dt>Kunde</dt>
          <dd>{getLeadDisplayName(offer.customerSnapshot)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Ansprechpartner</dt>
          <dd>{contactName}</dd>
        </div>
        {offer.tariffSnapshot ? (
          <div className={styles.row}>
            <dt>Tarif</dt>
            <dd>{offer.tariffSnapshot.name}</dd>
          </div>
        ) : null}
        <div className={styles.row}>
          <dt>Positionen</dt>
          <dd>{offer.items.length}</dd>
        </div>
        <div className={styles.row}>
          <dt>Aktualisiert</dt>
          <dd>{formatDate(offer.updatedAt)}</dd>
        </div>
      </dl>

      <OfferTotalsDisplay totals={totals} compact />

      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </article>
  );
}
