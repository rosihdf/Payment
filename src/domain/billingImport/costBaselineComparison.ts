import type { BillingPeriodQualityStatus } from './billingPeriodRecord';

export interface CostBaselineComparison {
  baselineId: string;
  baselineVersion: number;
  candidateId: string;
  currency: string;
  netGrossBasis: 'net' | 'gross' | 'unknown';
  projectionMonths: number;

  currentMonthlyRecurringCostsCents: number | null;
  bestPayMonthlyRecurringCostsCents: number | null;
  monthlyDifferenceCents: number | null;

  currentOneTimeCostsCents: number | null;
  bestPayOneTimeCostsCents: number | null;

  totalDifferenceOverPeriodCents: number | null;
  monthlySavingsCents: number | null;
  monthlyAdditionalCostsCents: number | null;
  paybackMonths: number | null;

  isFullyComparable: boolean;
  missingBasis: string[];
  dataQuality: BillingPeriodQualityStatus;
  isProjected: true;
}
