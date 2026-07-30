import type { PaymentComparisonResult } from '../../domain/calculator/comparison';
import { formatCentsToCurrency } from '../../utils/currency';
import { formatEffectiveRateTenthsOfBasisPoint } from '../../utils/percentageAmount';
import styles from './ComparisonResultsOverview.module.css';

interface ComparisonResultsOverviewProps {
  result: PaymentComparisonResult;
}

function formatSavingsLabel(amountCents: number): string {
  if (amountCents > 0) {
    return 'Monatliche Ersparnis';
  }

  if (amountCents < 0) {
    return 'Monatliche Mehrkosten';
  }

  return 'Monatliche Ersparnis';
}

function formatSavingsValue(amountCents: number): string {
  return formatCentsToCurrency(Math.abs(amountCents));
}

export function ComparisonResultsOverview({ result }: ComparisonResultsOverviewProps) {
  const monthlyTone =
    result.monthlySavingsCents > 0
      ? styles.positive
      : result.monthlySavingsCents < 0
        ? styles.negative
        : styles.neutral;

  const annualLabel =
    result.annualSavingsCents > 0
      ? 'Jährliche Ersparnis'
      : result.annualSavingsCents < 0
        ? 'Jährliche Mehrkosten'
        : 'Jährliche Ersparnis';

  const contractLabel =
    result.contractDurationSavingsCents > 0
      ? 'Ersparnis Vertragslaufzeit'
      : result.contractDurationSavingsCents < 0
        ? 'Mehrkosten Vertragslaufzeit'
        : 'Ersparnis Vertragslaufzeit';

  return (
    <section className={styles.overview} aria-label="Vergleichsergebnis">
      <h2 className={styles.title}>Ergebnisübersicht</h2>
      <div className={styles.cards}>
        <article className={`${styles.card} ${monthlyTone}`}>
          <h3 className={styles.cardTitle}>{formatSavingsLabel(result.monthlySavingsCents)}</h3>
          <p className={styles.cardValue}>{formatSavingsValue(result.monthlySavingsCents)}</p>
        </article>
        <article className={`${styles.card} ${monthlyTone}`}>
          <h3 className={styles.cardTitle}>{annualLabel}</h3>
          <p className={styles.cardValue}>{formatSavingsValue(result.annualSavingsCents)}</p>
        </article>
        <article className={`${styles.card} ${monthlyTone}`}>
          <h3 className={styles.cardTitle}>{contractLabel}</h3>
          <p className={styles.cardValue}>
            {formatSavingsValue(result.contractDurationSavingsCents)}
          </p>
        </article>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Effektive BestPay-Kostenquote</h3>
          <p className={styles.cardValue}>
            {formatEffectiveRateTenthsOfBasisPoint(result.bestPayEffectiveRateTenthsOfBasisPoint)}
          </p>
          <p className={styles.cardHint}>
            Aktuell:{' '}
            {formatEffectiveRateTenthsOfBasisPoint(result.currentEffectiveRateTenthsOfBasisPoint)}
          </p>
        </article>
      </div>

      <dl className={styles.metrics}>
        <div>
          <dt>Gesamt-Kartenvolumen monatlich</dt>
          <dd>{formatCentsToCurrency(result.totalMonthlyCardVolumeCents)}</dd>
        </div>
        <div>
          <dt>Gesamttransaktionen monatlich</dt>
          <dd>{result.totalMonthlyTransactionCount}</dd>
        </div>
        <div>
          <dt>Durchschnittsbon</dt>
          <dd>
            {result.averageReceiptCents !== null
              ? formatCentsToCurrency(result.averageReceiptCents)
              : '–'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
