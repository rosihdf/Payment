import type { ComparisonCostBreakdown } from '../../domain/calculator/comparison';
import { formatCentsToCurrency } from '../../utils/currency';
import styles from './ComparisonCostBreakdownCard.module.css';

interface ComparisonCostBreakdownCardProps {
  title: string;
  breakdown: ComparisonCostBreakdown;
  showFixedCostDetails?: boolean;
}

export function ComparisonCostBreakdownCard({
  title,
  breakdown,
  showFixedCostDetails = false,
}: ComparisonCostBreakdownCardProps) {
  const fixedCostRows = showFixedCostDetails
    ? ([
        ['Grundgebühr je Vertrag', breakdown.accountBaseFeeCents],
        ['Terminalmiete', breakdown.terminalRentalCents],
        ['Servicepauschale', breakdown.serviceFeeCents],
      ] as const)
    : ([['Terminalmiete', breakdown.terminalRentalCents]] as const);

  const rows = [
    ...fixedCostRows,
    ['Transaktionskosten', breakdown.transactionCostsCents],
    ['Girocard-Clearing', breakdown.girocardClearingCostsCents],
    ['Girocard-Netzserviceentgelt', breakdown.girocardPercentageCostsCents],
    ['Mastercard-/Visa-Acquiring', breakdown.creditCardPercentageCostsCents],
    ['Maestro-/VPAY-Acquiring', breakdown.debitCardPercentageCostsCents],
  ] as const;

  return (
    <article className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <dl className={styles.list}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd>{formatCentsToCurrency(value)}</dd>
          </div>
        ))}
        <div className={`${styles.row} ${styles.total}`}>
          <dt>Gesamtkosten monatlich</dt>
          <dd>{formatCentsToCurrency(breakdown.totalMonthlyCostsCents)}</dd>
        </div>
      </dl>
    </article>
  );
}
