import type { BestPaySolutionCandidate, RecommendationScoreBreakdown } from '../recommendation/bestPaySolutionCandidate';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { RecommendationWeightSet } from '../recommendation/recommendationWeightSet';

const STATUS_ELIGIBILITY_SCORE: Record<BestPaySolutionCandidate['status'], number> = {
  eligible: 100,
  limited: 70,
  critical: 40,
  blocked: 0,
  excluded: 0,
};

const REVIEW_CLASS_RISK_PENALTY: Record<string, number> = {
  standard: 0,
  attention: 15,
  critical: 35,
};

function scoreNeedFit(candidate: BestPaySolutionCandidate, need: CustomerNeed): number {
  let score = 50;

  if (candidate.fulfilledRequirements.includes('mobile_usage_match') && need.paymentUsage.mobile) {
    score += 20;
  }
  if (
    candidate.fulfilledRequirements.includes('stationary_usage_match') &&
    need.paymentUsage.stationary
  ) {
    score += 20;
  }
  if (candidate.fulfilledRequirements.includes('terminal_count_configured')) {
    score += 10;
  }

  score -= candidate.unfulfilledRequirements.length * 10;
  return Math.max(0, Math.min(100, score));
}

function scoreCost(candidate: BestPaySolutionCandidate): number {
  if (!candidate.costProjection.isComplete || candidate.costProjection.totalCostsCents === null) {
    return 30;
  }

  return 100;
}

function scoreTerm(candidate: BestPaySolutionCandidate, need: CustomerNeed): number {
  if (candidate.contractTermMonths === null) {
    return 40;
  }

  const preferred = need.contractPreferences.preferredTermMonths;
  if (preferred !== null && candidate.contractTermMonths === preferred) {
    return 100;
  }

  const maxTerm = need.contractPreferences.maxAcceptedTermMonths;
  if (maxTerm !== null && candidate.contractTermMonths <= maxTerm) {
    return 80;
  }

  return candidate.isStandardTerm ? 70 : 50;
}

function scoreHardware(candidate: BestPaySolutionCandidate): number {
  return candidate.hardwareProductIds.length > 0 ? 90 : 60;
}

function scoreRisk(candidate: BestPaySolutionCandidate): number {
  const reviewClass = candidate.pricingEvaluation?.reviewClass ?? 'standard';
  const penalty = REVIEW_CLASS_RISK_PENALTY[reviewClass] ?? 0;
  return Math.max(0, 100 - penalty);
}

function scoreCompleteness(candidate: BestPaySolutionCandidate): number {
  if (candidate.costProjection.isComplete) {
    return 100;
  }

  const missingCount = candidate.costProjection.missingBasis.length;
  return Math.max(0, 100 - missingCount * 20);
}

function scoreInternalBusiness(candidate: BestPaySolutionCandidate): number {
  const commission = candidate.commissionPreview;
  if (!commission || commission.status === 'blocked') {
    return 0;
  }

  if (commission.finalExpectedCommissionAmountCents <= 0) {
    return 20;
  }

  return Math.min(100, Math.round(commission.finalExpectedCommissionAmountCents / 100));
}

export function scoreCandidate(
  candidate: BestPaySolutionCandidate,
  need: CustomerNeed,
  weightSet: RecommendationWeightSet | null,
): RecommendationScoreBreakdown {
  const breakdown: RecommendationScoreBreakdown = {
    eligibilityScore: STATUS_ELIGIBILITY_SCORE[candidate.status],
    needFitScore: scoreNeedFit(candidate, need),
    costScore: scoreCost(candidate),
    termScore: scoreTerm(candidate, need),
    hardwareScore: scoreHardware(candidate),
    riskScore: scoreRisk(candidate),
    completenessScore: scoreCompleteness(candidate),
    internalBusinessScore: scoreInternalBusiness(candidate),
    totalScore: 0,
  };

  if (weightSet && weightSet.status === 'published') {
    const weights = weightSet.weights;
    const weightSum =
      weights.eligibilityScore +
      weights.needFitScore +
      weights.costScore +
      weights.termScore +
      weights.hardwareScore +
      weights.riskScore +
      weights.completenessScore +
      weights.internalBusinessScore;

    if (weightSum > 0) {
      breakdown.totalScore = Math.round(
        (breakdown.eligibilityScore * weights.eligibilityScore +
          breakdown.needFitScore * weights.needFitScore +
          breakdown.costScore * weights.costScore +
          breakdown.termScore * weights.termScore +
          breakdown.hardwareScore * weights.hardwareScore +
          breakdown.riskScore * weights.riskScore +
          breakdown.completenessScore * weights.completenessScore +
          breakdown.internalBusinessScore * weights.internalBusinessScore) /
          weightSum,
      );
      return breakdown;
    }
  }

  breakdown.totalScore = Math.round(
    breakdown.eligibilityScore * 0.25 +
      breakdown.needFitScore * 0.2 +
      breakdown.costScore * 0.2 +
      breakdown.termScore * 0.1 +
      breakdown.hardwareScore * 0.05 +
      breakdown.riskScore * 0.15 +
      breakdown.completenessScore * 0.05,
  );

  return breakdown;
}
