import type { BestPayComparisonVariantSummary } from './bestPayComparisonSession';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import type { ScoredCandidate } from '../recommendation/bestPaySolutionCandidate';
import type { CustomerCostBaseline } from '../billingImport/customerCostBaseline';
import type { RecommendationReason } from '../recommendation/recommendationReason';

export function summarizeComparisonVariant(
  scored: ScoredCandidate,
  currentMonthlyCostsCents: number | null,
  reasons: RecommendationReason[] = [],
): BestPayComparisonVariantSummary {
  const candidate = scored.candidate;
  const monthly = candidate.costProjection.averageMonthlyCostsCents;
  const annual = monthly !== null ? monthly * 12 : null;
  const oneTime = candidate.costProjection.oneTimeCostsCents;
  const savingsMonthly =
    currentMonthlyCostsCents !== null && monthly !== null
      ? currentMonthlyCostsCents - monthly
      : null;
  const savingsAnnual = savingsMonthly !== null ? savingsMonthly * 12 : null;
  const savingsPercent =
    currentMonthlyCostsCents !== null &&
    currentMonthlyCostsCents > 0 &&
    savingsMonthly !== null
      ? Math.round((savingsMonthly / currentMonthlyCostsCents) * 1000) / 10
      : null;

  return {
    candidateId: candidate.candidateId,
    tariffId: candidate.tariffId,
    tariffName: candidate.tariffName,
    productId: candidate.hardwareProductIds[0] ?? null,
    productName: candidate.hardwareProductNames[0] ?? null,
    termMonths: candidate.contractTermMonths,
    monthlyTotalCostsCents: monthly,
    annualTotalCostsCents: annual,
    oneTimeCostsCents: oneTime,
    savingsMonthlyCents: savingsMonthly,
    savingsAnnualCents: savingsAnnual,
    savingsPercent,
    isHigherCost: savingsMonthly !== null ? savingsMonthly < 0 : false,
    commissionTotalCents:
      candidate.commissionPreview?.finalExpectedCommissionAmountCents ?? null,
    score: scored.scoreBreakdown.totalScore,
    rank: candidate.rank,
    primaryReasons: reasons.map((reason) => reason.customerFacingText),
  };
}

export function summarizePrimaryCandidate(
  candidate: BestPaySolutionCandidate,
  score: number | null,
  currentMonthlyCostsCents: number | null,
  reasons: RecommendationReason[],
): BestPayComparisonVariantSummary {
  const monthly = candidate.costProjection.averageMonthlyCostsCents;
  const annual = monthly !== null ? monthly * 12 : null;
  const savingsMonthly =
    currentMonthlyCostsCents !== null && monthly !== null
      ? currentMonthlyCostsCents - monthly
      : null;

  return {
    candidateId: candidate.candidateId,
    tariffId: candidate.tariffId,
    tariffName: candidate.tariffName,
    productId: candidate.hardwareProductIds[0] ?? null,
    productName: candidate.hardwareProductNames[0] ?? null,
    termMonths: candidate.contractTermMonths,
    monthlyTotalCostsCents: monthly,
    annualTotalCostsCents: annual,
    oneTimeCostsCents: candidate.costProjection.oneTimeCostsCents,
    savingsMonthlyCents: savingsMonthly,
    savingsAnnualCents: savingsMonthly !== null ? savingsMonthly * 12 : null,
    savingsPercent:
      currentMonthlyCostsCents !== null &&
      currentMonthlyCostsCents > 0 &&
      savingsMonthly !== null
        ? Math.round((savingsMonthly / currentMonthlyCostsCents) * 1000) / 10
        : null,
    isHigherCost: savingsMonthly !== null ? savingsMonthly < 0 : false,
    commissionTotalCents:
      candidate.commissionPreview?.finalExpectedCommissionAmountCents ?? null,
    score,
    rank: candidate.rank,
    primaryReasons: reasons.map((reason) => reason.customerFacingText),
  };
}

export function resolveCurrentMonthlyCosts(
  baseline: CustomerCostBaseline | null,
  manualMonthlyTotal: number | null,
): number | null {
  if (baseline?.status === 'confirmed' && baseline.avgMonthlyTotalCostsCents !== null) {
    return baseline.avgMonthlyTotalCostsCents;
  }
  return manualMonthlyTotal;
}
