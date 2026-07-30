import type {
  BestPaySolutionCandidate,
  ScoredCandidate,
} from '../recommendation/bestPaySolutionCandidate';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { RecommendationAlternative } from '../recommendation/recommendationResult';
import {
  RECOMMENDATION_REASON_CODES,
  createRecommendationReason,
  type RecommendationReason,
} from '../recommendation/recommendationReason';
import type { RecommendationTieBreakerKey, RecommendationWeightSet } from '../recommendation/recommendationWeightSet';
import { DEFAULT_TIE_BREAKERS } from '../recommendation/recommendationWeightSet';

const STATUS_ORDER: Record<BestPaySolutionCandidate['status'], number> = {
  eligible: 0,
  limited: 1,
  critical: 2,
  blocked: 3,
  excluded: 4,
};

const REVIEW_ORDER = { standard: 0, attention: 1, critical: 2 } as const;

function compareByTieBreaker(
  left: ScoredCandidate,
  right: ScoredCandidate,
  key: RecommendationTieBreakerKey,
  need: CustomerNeed,
  commissionTieBreakerEnabled: boolean,
): number {
  switch (key) {
    case 'fewer_critical_findings': {
      const leftClass = left.candidate.pricingEvaluation?.reviewClass ?? 'standard';
      const rightClass = right.candidate.pricingEvaluation?.reviewClass ?? 'standard';
      return REVIEW_ORDER[leftClass] - REVIEW_ORDER[rightClass];
    }
    case 'higher_completeness':
      return right.scoreBreakdown.completenessScore - left.scoreBreakdown.completenessScore;
    case 'lower_total_cost': {
      const leftCost = left.candidate.costProjection.totalCostsCents;
      const rightCost = right.candidate.costProjection.totalCostsCents;
      if (leftCost === null && rightCost === null) {
        return 0;
      }
      if (leftCost === null) {
        return 1;
      }
      if (rightCost === null) {
        return -1;
      }
      return leftCost - rightCost;
    }
    case 'better_term_fit': {
      const preferred = need.contractPreferences.preferredTermMonths;
      if (preferred === null) {
        return 0;
      }
      const leftDiff = Math.abs((left.candidate.contractTermMonths ?? 999) - preferred);
      const rightDiff = Math.abs((right.candidate.contractTermMonths ?? 999) - preferred);
      return leftDiff - rightDiff;
    }
    case 'fewer_special_cases': {
      const leftSpecial = left.candidate.pricingEvaluation?.isSpecialTerm ? 1 : 0;
      const rightSpecial = right.candidate.pricingEvaluation?.isSpecialTerm ? 1 : 0;
      return leftSpecial - rightSpecial;
    }
    case 'internal_business':
      if (!commissionTieBreakerEnabled) {
        return 0;
      }
      return (
        right.scoreBreakdown.internalBusinessScore - left.scoreBreakdown.internalBusinessScore
      );
    case 'candidate_code':
      return left.candidate.candidateCode.localeCompare(right.candidate.candidateCode, 'de');
    default:
      return 0;
  }
}

export function rankCandidates(
  scoredCandidates: ScoredCandidate[],
  need: CustomerNeed,
  weightSet: RecommendationWeightSet | null,
): { ranked: ScoredCandidate[]; tieBreakerUsed: string | null } {
  const tieBreakers = weightSet?.tieBreakers ?? DEFAULT_TIE_BREAKERS;
  const commissionTieBreakerEnabled = weightSet?.commissionTieBreakerEnabled ?? false;

  const rankable = scoredCandidates.filter(
    (entry) => entry.candidate.status !== 'excluded' && entry.candidate.status !== 'blocked',
  );

  const sorted = rankable.slice().sort((left, right) => {
    const statusDiff =
      STATUS_ORDER[left.candidate.status] - STATUS_ORDER[right.candidate.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const scoreDiff = right.scoreBreakdown.totalScore - left.scoreBreakdown.totalScore;
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    for (const tieBreaker of tieBreakers) {
      const diff = compareByTieBreaker(
        left,
        right,
        tieBreaker,
        need,
        commissionTieBreakerEnabled,
      );
      if (diff !== 0) {
        return diff;
      }
    }

    return left.candidate.candidateCode.localeCompare(right.candidate.candidateCode, 'de');
  });

  let tieBreakerUsed: string | null = null;
  if (sorted.length >= 2) {
    const first = sorted[0]!;
    const second = sorted[1]!;
    if (first.scoreBreakdown.totalScore === second.scoreBreakdown.totalScore) {
      tieBreakerUsed = tieBreakers.join(',');
    }
  }

  const ranked = sorted.map((entry, index) => ({
    ...entry,
    candidate: {
      ...entry.candidate,
      rank: index + 1,
    },
  }));

  return { ranked, tieBreakerUsed };
}

function candidatesAreSimilar(
  primary: BestPaySolutionCandidate,
  alternative: BestPaySolutionCandidate,
): boolean {
  if (primary.tariffId !== alternative.tariffId) {
    return false;
  }
  if (primary.contractTermMonths !== alternative.contractTermMonths) {
    return false;
  }
  if (primary.hardwareProductIds.join(',') !== alternative.hardwareProductIds.join(',')) {
    return false;
  }

  const primaryCost = primary.costProjection.totalCostsCents;
  const alternativeCost = alternative.costProjection.totalCostsCents;
  if (primaryCost !== null && alternativeCost !== null) {
    const diff = Math.abs(primaryCost - alternativeCost);
    const threshold = Math.max(primaryCost, alternativeCost) * 0.05;
    if (diff <= threshold) {
      return true;
    }
  }

  return true;
}

function buildAlternativeReasons(
  primary: BestPaySolutionCandidate,
  alternative: BestPaySolutionCandidate,
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];

  const primaryFixed = primary.costProjection.monthlyFixedCostsCents;
  const altFixed = alternative.costProjection.monthlyFixedCostsCents;
  if (
    primaryFixed !== null &&
    altFixed !== null &&
    altFixed < primaryFixed
  ) {
    reasons.push(
      createRecommendationReason({
        code: RECOMMENDATION_REASON_CODES.ALTERNATIVE_LOWER_FIXED_COST,
        category: 'alternative',
        priority: 1,
        customerFacingText: 'Niedrigere monatliche Fixkosten als die Primärempfehlung.',
        internalText: null,
        relatedInputField: null,
        relatedCandidateId: alternative.candidateId,
        isPositive: true,
        quantifiedDifferenceCents: primaryFixed - altFixed,
      }),
    );
  }

  if (
    primary.contractTermMonths !== null &&
    alternative.contractTermMonths !== null &&
    alternative.contractTermMonths < primary.contractTermMonths
  ) {
    reasons.push(
      createRecommendationReason({
        code: RECOMMENDATION_REASON_CODES.ALTERNATIVE_SHORTER_TERM,
        category: 'alternative',
        priority: 2,
        customerFacingText: 'Kürzere Vertragslaufzeit bei vergleichbarer Eignung.',
        internalText: null,
        relatedInputField: null,
        relatedCandidateId: alternative.candidateId,
        isPositive: true,
        quantifiedDifferenceCents: null,
      }),
    );
  }

  return reasons;
}

export function selectAlternatives(
  ranked: ScoredCandidate[],
  maxAlternatives: number,
): RecommendationAlternative[] {
  if (ranked.length <= 1) {
    return [];
  }

  const primary = ranked[0]!.candidate;
  const alternatives: RecommendationAlternative[] = [];

  for (const entry of ranked.slice(1)) {
    if (alternatives.length >= maxAlternatives) {
      break;
    }

    if (candidatesAreSimilar(primary, entry.candidate)) {
      continue;
    }

    const costDiff =
      primary.costProjection.totalCostsCents !== null &&
      entry.candidate.costProjection.totalCostsCents !== null
        ? entry.candidate.costProjection.totalCostsCents -
          primary.costProjection.totalCostsCents
        : null;

    const termDiff =
      primary.contractTermMonths !== null && entry.candidate.contractTermMonths !== null
        ? entry.candidate.contractTermMonths - primary.contractTermMonths
        : null;

    alternatives.push({
      candidate: entry.candidate,
      rank: entry.candidate.rank ?? alternatives.length + 2,
      mainDifference:
        costDiff !== null && costDiff < 0
          ? 'Niedrigere Gesamtkosten'
          : termDiff !== null && termDiff < 0
            ? 'Kürzere Laufzeit'
            : 'Andere BestPay-Konfiguration',
      costDifferenceCents: costDiff,
      termDifferenceMonths: termDiff,
      hardwareDifference:
        entry.candidate.hardwareProductNames.join(', ') !==
        primary.hardwareProductNames.join(', ')
          ? entry.candidate.hardwareProductNames.join(', ')
          : null,
      riskLabel: entry.candidate.pricingEvaluation?.reviewClass ?? 'unbekannt',
      suitabilityHint: entry.candidate.status === 'limited' ? 'Eingeschränkt geeignet' : 'Geeignet',
      reasons: buildAlternativeReasons(primary, entry.candidate),
    });
  }

  return alternatives;
}

export function buildPrimaryReasons(
  primary: BestPaySolutionCandidate,
  allRanked: ScoredCandidate[],
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];

  reasons.push(
    createRecommendationReason({
      code: RECOMMENDATION_REASON_CODES.BEST_NEED_FIT,
      category: 'need_fit',
      priority: 1,
      customerFacingText: 'Beste fachliche Passung zum erfassten Kundenbedarf.',
      internalText: null,
      relatedInputField: null,
      relatedCandidateId: primary.candidateId,
      isPositive: true,
      quantifiedDifferenceCents: null,
    }),
  );

  if (!primary.costProjection.isComplete) {
    reasons.push(
      createRecommendationReason({
        code: RECOMMENDATION_REASON_CODES.COST_PROJECTION_INCOMPLETE,
        category: 'limitation',
        priority: 5,
        customerFacingText:
          'Die Kostenprojektion ist unvollständig – Vergleichbarkeit eingeschränkt.',
        internalText: primary.costProjection.missingBasis.join(', '),
        relatedInputField: null,
        relatedCandidateId: primary.candidateId,
        isPositive: false,
        quantifiedDifferenceCents: null,
      }),
    );
  } else {
    const lowestCost = allRanked
      .filter((entry) => entry.candidate.costProjection.isComplete)
      .map((entry) => entry.candidate.costProjection.totalCostsCents!)
      .sort((left, right) => left - right)[0];

    if (lowestCost !== undefined && primary.costProjection.totalCostsCents === lowestCost) {
      reasons.push(
        createRecommendationReason({
          code: RECOMMENDATION_REASON_CODES.LOWEST_PROJECTED_TOTAL_COST,
          category: 'cost',
          priority: 2,
          customerFacingText: 'Niedrigste prognostizierte Gesamtkosten im Vergleich.',
          internalText: null,
          relatedInputField: null,
          relatedCandidateId: primary.candidateId,
          isPositive: true,
          quantifiedDifferenceCents: null,
        }),
      );
    }
  }

  if (primary.pricingEvaluation?.reviewClass === 'attention') {
    reasons.push(
      createRecommendationReason({
        code: RECOMMENDATION_REASON_CODES.PRICE_REVIEW_REQUIRED,
        category: 'risk',
        priority: 3,
        customerFacingText: 'Preis- oder Freigabeprüfung erforderlich.',
        internalText: null,
        relatedInputField: null,
        relatedCandidateId: primary.candidateId,
        isPositive: false,
        quantifiedDifferenceCents: null,
      }),
    );
  }

  return reasons;
}
