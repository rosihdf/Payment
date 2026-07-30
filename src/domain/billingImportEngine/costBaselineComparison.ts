import type { CustomerCostBaseline } from '../billingImport/customerCostBaseline';
import type { CostBaselineComparison } from '../billingImport/costBaselineComparison';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';

export function compareBaselineWithCandidate(
  baseline: CustomerCostBaseline,
  candidate: BestPaySolutionCandidate,
): CostBaselineComparison {
  const projection = candidate.costProjection;
  const missingBasis: string[] = [];

  if (baseline.currency !== projection.currency) {
    missingBasis.push('currency');
  }
  if (baseline.netGrossBasis !== 'unknown' && baseline.netGrossBasis !== 'net') {
    missingBasis.push('netGrossBasis');
  }
  if (baseline.avgMonthlyTotalCostsCents === null) {
    missingBasis.push('baselineMonthlyTotal');
  }
  if (projection.monthlyFixedCostsCents === null && projection.totalCostsCents === null) {
    missingBasis.push('bestPayMonthlyCosts');
  }

  const currentMonthly =
    baseline.avgMonthlyTotalCostsCents ??
    (baseline.avgMonthlyFixedCostsCents ?? 0) +
      (baseline.avgMonthlyTransactionCostsCents ?? 0) +
      (baseline.avgMonthlyVolumeBasedCostsCents ?? 0);

  const bestPayMonthly =
    projection.averageMonthlyCostsCents ??
    projection.monthlyFixedCostsCents ??
    (projection.totalCostsCents !== null
      ? Math.round(projection.totalCostsCents / projection.projectionMonths)
      : null);

  const monthlyDifference =
    currentMonthly !== null && bestPayMonthly !== null
      ? bestPayMonthly - currentMonthly
      : null;

  const projectionMonths = projection.projectionMonths;
  const totalDifference =
    monthlyDifference !== null ? monthlyDifference * projectionMonths : null;

  let paybackMonths: number | null = null;
  const bestPayOneTime = projection.oneTimeCostsCents ?? 0;
  const baselineOneTime = baseline.totalOneTimeCostsCents ?? 0;
  const additionalOneTime = bestPayOneTime - baselineOneTime;

  if (
    additionalOneTime > 0 &&
    monthlyDifference !== null &&
    monthlyDifference < 0 &&
    missingBasis.length === 0
  ) {
    paybackMonths = Math.ceil(additionalOneTime / Math.abs(monthlyDifference));
  }

  const isFullyComparable =
    missingBasis.length === 0 &&
    baseline.avgMonthlyTotalCostsCents !== null &&
    bestPayMonthly !== null &&
    baseline.qualityStatus !== 'poor' &&
    baseline.qualityStatus !== 'unusable';

  return {
    baselineId: baseline.id,
    baselineVersion: baseline.version,
    candidateId: candidate.candidateId,
    currency: baseline.currency,
    netGrossBasis: baseline.netGrossBasis,
    projectionMonths,
    currentMonthlyRecurringCostsCents: currentMonthly,
    bestPayMonthlyRecurringCostsCents: bestPayMonthly,
    monthlyDifferenceCents: monthlyDifference,
    currentOneTimeCostsCents: baseline.totalOneTimeCostsCents,
    bestPayOneTimeCostsCents: projection.oneTimeCostsCents,
    totalDifferenceOverPeriodCents: totalDifference,
    monthlySavingsCents:
      monthlyDifference !== null && monthlyDifference < 0 ? Math.abs(monthlyDifference) : null,
    monthlyAdditionalCostsCents:
      monthlyDifference !== null && monthlyDifference > 0 ? monthlyDifference : null,
    paybackMonths,
    isFullyComparable,
    missingBasis,
    dataQuality: baseline.qualityStatus,
    isProjected: true,
  };
}

export function applyBaselineToCurrentSituation(
  baseline: CustomerCostBaseline,
): import('../recommendation/customerNeed').CurrentSituationBaseline {
  return {
    monthlyFixedCostsCents: baseline.avgMonthlyFixedCostsCents,
    transactionCostsCents: baseline.avgMonthlyTransactionCostsCents,
    hardwareCostsCents: baseline.avgMonthlyTerminalCostsCents,
    contractTermMonths: null,
    monthlyTotalCostsCents: baseline.avgMonthlyTotalCostsCents,
  };
}

export function applyBaselineToNeedFields(
  baseline: CustomerCostBaseline,
): {
  monthlyCardVolumeCents: number | null;
  monthlyTransactions: number | null;
  averageTransactionValueCents: number | null;
} {
  return {
    monthlyCardVolumeCents: baseline.avgMonthlyCardVolumeCents,
    monthlyTransactions: baseline.avgMonthlyTransactionCount,
    averageTransactionValueCents: baseline.avgTicketCents,
  };
}
