import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { BestPayComparisonConditions } from '../../domain/calculator/comparison';
import type { Tariff } from '../../domain/tariff/tariff';
import { formatCardRate, formatGirocardClearing } from '../../utils/formatTariff';
import { formatTerminalTypes } from '../../utils/formatTerminalTypes';
import { formatCentsToCurrency } from '../../utils/currency';
import { formatTenthsOfCentToCurrency } from '../../utils/tenthsOfCent';
import { FormControl } from '../../components/common/FormControl';
import styles from './BestPayOfferPanel.module.css';

interface BestPayOfferPanelProps {
  tariffs: Tariff[];
  selectedTariffId: string | null;
  bestPayConditions: BestPayComparisonConditions | null;
  tariffError?: string;
  onTariffChange: (tariffId: string) => void;
}

export function BestPayOfferPanel({
  tariffs,
  selectedTariffId,
  bestPayConditions,
  tariffError,
  onTariffChange,
}: BestPayOfferPanelProps) {
  if (tariffs.length === 0) {
    return (
      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>Angebot von BestPay</h2>
        <EmptyState
          title="Keine aktiven Tarife verfügbar"
          description="Für den Vergleich werden aktive BestPay-Tarife benötigt."
          action={
            <Link className={styles.adminLink} to="/admin/catalog?tab=tariffs">
              Zu Tarifen
            </Link>
          }
        />
      </article>
    );
  }

  const selectedTariff = tariffs.find((tariff) => tariff.id === selectedTariffId) ?? null;

  return (
    <article className={styles.panel}>
      <h2 className={styles.panelTitle}>Angebot von BestPay</h2>
      <p className={styles.panelDescription}>
        Konditionen aus einem aktiven BestPay-Tarif – nur zur Ansicht.
      </p>

      <FormControl
        type="select"
        id="bestpay-tariff-select"
        label="BestPay-Tarif"
        error={tariffError}
        value={selectedTariffId ?? ''}
        onChange={(event) => onTariffChange(event.target.value)}
      >
        {tariffs.map((tariff) => (
          <option key={tariff.id} value={tariff.id}>
            {tariff.name} ({tariff.productCode})
          </option>
        ))}
      </FormControl>

      {selectedTariff && bestPayConditions ? (
        <dl className={styles.summary}>
          <div className={styles.summaryRow}>
            <dt>Tarif</dt>
            <dd>{bestPayConditions.tariffName}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Produktcode (intern)</dt>
            <dd>{bestPayConditions.productCode}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Einsatzarten</dt>
            <dd>{formatTerminalTypes(selectedTariff.supportedTerminalTypes)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Grundgebühr je Vertrag</dt>
            <dd>{formatCentsToCurrency(bestPayConditions.monthlyAccountBaseFeeCents)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Terminalmiete je Terminal</dt>
            <dd>{formatCentsToCurrency(bestPayConditions.monthlyTerminalRentalCents)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Servicepauschale je Terminal</dt>
            <dd>{formatCentsToCurrency(bestPayConditions.monthlyServiceFeePerTerminalCents)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Transaktionspreis</dt>
            <dd>{formatTenthsOfCentToCurrency(bestPayConditions.transactionFeeTenthsOfCent)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Clearing Girocard</dt>
            <dd>
              {formatGirocardClearing(
                selectedTariff.girocardClearingIncluded,
                bestPayConditions.girocardClearingFeeTenthsOfCent,
              )}
            </dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Girocard-Entgelt</dt>
            <dd>{formatCardRate(selectedTariff.cardRates.girocard)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Debitkartenentgelt</dt>
            <dd>{formatCardRate(selectedTariff.cardRates.debit)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Kreditkartenentgelt</dt>
            <dd>{formatCardRate(selectedTariff.cardRates.credit)}</dd>
          </div>
        </dl>
      ) : null}
    </article>
  );
}
