import type { OfferTotals } from '../../domain/offer/offer';
import {
  formatOfferMonthlyTotal,
  formatOfferOneTimeTotal,
} from '../../utils/formatOffer';
import styles from './OfferTotalsDisplay.module.css';

interface OfferTotalsDisplayProps {
  totals: OfferTotals;
  compact?: boolean;
}

export function OfferTotalsDisplay({ totals, compact = false }: OfferTotalsDisplayProps) {
  return (
    <dl className={compact ? styles.compact : styles.totals}>
      <div className={styles.row}>
        <dt>Monatlich gesamt</dt>
        <dd>{formatOfferMonthlyTotal(totals.monthlyTotalCents)}</dd>
      </div>
      <div className={styles.row}>
        <dt>Einmalig gesamt</dt>
        <dd>{formatOfferOneTimeTotal(totals.oneTimeTotalCents)}</dd>
      </div>
      {totals.hasOnRequestItems ? (
        <div className={styles.hint}>
          {totals.onRequestItemCount}{' '}
          {totals.onRequestItemCount === 1 ? 'Position' : 'Positionen'} mit Preis auf Anfrage
        </div>
      ) : null}
    </dl>
  );
}
