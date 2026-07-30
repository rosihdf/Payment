import type { BillingPeriodRecord } from '../billingImport/billingPeriodRecord';

export interface OutlierDetectionResult {
  periodId: string;
  metric: string;
  value: number;
  baseline: number;
  deviationRatio: number;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
  }
  return sorted[middle]!;
}

export function detectBillingOutliers(periods: BillingPeriodRecord[]): OutlierDetectionResult[] {
  const confirmed = periods.filter((period) => period.confirmationStatus === 'confirmed');
  if (confirmed.length < 3) {
    return [];
  }

  const totals = confirmed
    .map((period) => period.totalAmountCents)
    .filter((value): value is number => value !== null);
  const volumes = confirmed
    .map((period) => period.cardVolumeCents)
    .filter((value): value is number => value !== null);

  const results: OutlierDetectionResult[] = [];
  const totalMedian = median(totals);
  const volumeMedian = median(volumes);

  for (const period of confirmed) {
    if (period.totalAmountCents !== null && totalMedian > 0) {
      const ratio = period.totalAmountCents / totalMedian;
      if (ratio >= 2 || ratio <= 0.5) {
        results.push({
          periodId: period.id,
          metric: 'totalAmountCents',
          value: period.totalAmountCents,
          baseline: totalMedian,
          deviationRatio: ratio,
        });
        period.outlierStatus = 'detected';
      }
    }

    if (period.cardVolumeCents !== null && volumeMedian > 0) {
      const ratio = period.cardVolumeCents / volumeMedian;
      if (ratio >= 2.5 || ratio <= 0.4) {
        results.push({
          periodId: period.id,
          metric: 'cardVolumeCents',
          value: period.cardVolumeCents,
          baseline: volumeMedian,
          deviationRatio: ratio,
        });
        period.outlierStatus = 'detected';
      }
    }
  }

  return results;
}
