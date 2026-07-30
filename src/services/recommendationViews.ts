import type { BestPayRecommendationResult } from '../domain/recommendation/recommendationResult';
import type { RecommendationAlternative } from '../domain/recommendation/recommendationResult';
import type { RecommendationReason } from '../domain/recommendation/recommendationReason';
import type { RecommendationFinding } from '../domain/recommendation/recommendationFinding';

export interface SalesRecommendationCandidateView {
  candidateId: string;
  label: string;
  rank: number | null;
  status: string;
  termMonths: number | null;
  hardwareLabel: string;
  monthlyFixedCostsCents: number | null;
  totalCostsCents: number | null;
  costProjectionComplete: boolean;
  reviewClass: string;
  reasons: string[];
}

export interface CostBaselineComparisonView {
  baselineId: string;
  baselineVersion: number;
  currentMonthlyCostsLabel: string;
  bestPayMonthlyCostsLabel: string;
  monthlyDifferenceLabel: string;
  monthlySavingsLabel: string | null;
  monthlyAdditionalCostsLabel: string | null;
  paybackMonths: number | null;
  isFullyComparable: boolean;
  dataQuality: string;
  isProjected: boolean;
  missingBasis: string[];
}

export interface SalesRecommendationView {
  recordId: string | null;
  version: number | null;
  status: string;
  stale: boolean;
  needComplete: boolean;
  missingNeedFields: string[];
  primary: SalesRecommendationCandidateView | null;
  alternatives: Array<{
    candidateId: string;
    label: string;
    rank: number;
    mainDifference: string;
    costDifferenceCents: number | null;
    reasons: string[];
  }>;
  findings: Array<{
    code: string;
    salesDescription: string;
    requiredAction: string | null;
  }>;
  selection: {
    selectedCandidateId: string | null;
    selectionType: string | null;
    isDeviation: boolean;
    deviationReason: string;
  };
  canApplySelection: boolean;
  ownCommissionHint: string | null;
  costBaselineComparison: CostBaselineComparisonView | null;
}

export interface AdminRecommendationCandidateView extends SalesRecommendationCandidateView {
  candidateCode: string;
  scoreBreakdown: {
    eligibilityScore: number;
    needFitScore: number;
    costScore: number;
    termScore: number;
    hardwareScore: number;
    riskScore: number;
    completenessScore: number;
    internalBusinessScore: number;
    totalScore: number;
  } | null;
  exclusionReasons: string[];
  pricingReviewClass: string | null;
  commissionStatus: string | null;
  expectedCommissionCents: number | null;
}

export interface AdminRecommendationView {
  recordId: string | null;
  version: number | null;
  status: string;
  stale: boolean;
  inputFingerprint: string;
  weightSetLabel: string;
  tieBreakerUsed: string | null;
  commissionTieBreakerActive: boolean;
  primary: AdminRecommendationCandidateView | null;
  rankedCandidates: AdminRecommendationCandidateView[];
  blockedCandidates: AdminRecommendationCandidateView[];
  excludedCandidates: AdminRecommendationCandidateView[];
  alternatives: RecommendationAlternative[];
  primaryReasons: RecommendationReason[];
  findings: RecommendationFinding[];
  snapshotEvaluatedAt: string | null;
}

function formatCandidateLabel(tariffName: string, termMonths: number | null): string {
  const termLabel = termMonths !== null ? ` (${termMonths} Mon.)` : '';
  return `${tariffName}${termLabel}`;
}

function toSalesCandidateView(
  candidate: import('../domain/recommendation/bestPaySolutionCandidate').BestPaySolutionCandidate,
  reasons: string[] = [],
): SalesRecommendationCandidateView {
  return {
    candidateId: candidate.candidateId,
    label: formatCandidateLabel(candidate.tariffName, candidate.contractTermMonths),
    rank: candidate.rank,
    status: candidate.status,
    termMonths: candidate.contractTermMonths,
    hardwareLabel: candidate.hardwareProductNames.join(', ') || '—',
    monthlyFixedCostsCents: candidate.costProjection.monthlyFixedCostsCents,
    totalCostsCents: candidate.costProjection.totalCostsCents,
    costProjectionComplete: candidate.costProjection.isComplete,
    reviewClass: candidate.pricingEvaluation?.reviewClass ?? 'unbekannt',
    reasons,
  };
}

export function toCostBaselineComparisonView(
  comparison: import('../domain/billingImport/costBaselineComparison').CostBaselineComparison,
): CostBaselineComparisonView {
  const formatCents = (value: number | null): string =>
    value === null
      ? '—'
      : new Intl.NumberFormat('de-DE', { style: 'currency', currency: comparison.currency || 'EUR' }).format(
          value / 100,
        );

  return {
    baselineId: comparison.baselineId,
    baselineVersion: comparison.baselineVersion,
    currentMonthlyCostsLabel: formatCents(comparison.currentMonthlyRecurringCostsCents),
    bestPayMonthlyCostsLabel: formatCents(comparison.bestPayMonthlyRecurringCostsCents),
    monthlyDifferenceLabel: formatCents(comparison.monthlyDifferenceCents),
    monthlySavingsLabel:
      comparison.monthlySavingsCents !== null ? formatCents(comparison.monthlySavingsCents) : null,
    monthlyAdditionalCostsLabel:
      comparison.monthlyAdditionalCostsCents !== null
        ? formatCents(comparison.monthlyAdditionalCostsCents)
        : null,
    paybackMonths: comparison.paybackMonths,
    isFullyComparable: comparison.isFullyComparable,
    dataQuality: comparison.dataQuality,
    isProjected: comparison.isProjected,
    missingBasis: comparison.missingBasis,
  };
}

export function toSalesRecommendationView(input: {
  recordId: string | null;
  version: number | null;
  result: BestPayRecommendationResult | null;
  stale: boolean;
  selection: SalesRecommendationView['selection'];
  canApplySelection: boolean;
  costBaselineComparison?: CostBaselineComparisonView | null;
}): SalesRecommendationView {
  const result = input.result;

  if (!result) {
    return {
      recordId: input.recordId,
      version: input.version,
      status: 'draft',
      stale: input.stale,
      needComplete: false,
      missingNeedFields: [],
      primary: null,
      alternatives: [],
      findings: [],
      selection: input.selection,
      canApplySelection: false,
      ownCommissionHint: null,
      costBaselineComparison: input.costBaselineComparison ?? null,
    };
  }

  return {
    recordId: input.recordId,
    version: input.version,
    status: result.status,
    stale: input.stale,
    needComplete: result.needCompleteness.isComplete,
    missingNeedFields: result.needCompleteness.missingFields,
    primary: result.primaryCandidate
      ? toSalesCandidateView(
          result.primaryCandidate,
          result.primaryReasons.map((reason) => reason.customerFacingText),
        )
      : null,
    alternatives: result.alternatives.map((alternative) => ({
      candidateId: alternative.candidate.candidateId,
      label: formatCandidateLabel(
        alternative.candidate.tariffName,
        alternative.candidate.contractTermMonths,
      ),
      rank: alternative.rank,
      mainDifference: alternative.mainDifference,
      costDifferenceCents: alternative.costDifferenceCents,
      reasons: alternative.reasons.map((reason) => reason.customerFacingText),
    })),
    findings: result.findings
      .filter((finding) => finding.salesDescription !== null)
      .map((finding) => ({
        code: finding.code,
        salesDescription: finding.salesDescription!,
        requiredAction: finding.requiredAction,
      })),
    selection: input.selection,
    canApplySelection: input.canApplySelection && !input.stale,
    ownCommissionHint:
      result.primaryCandidate?.commissionPreview &&
      result.primaryCandidate.commissionPreview.status === 'preview'
        ? 'Provisionsvorschau liegt vor – endgültige Provision folgt mit Angebot.'
        : null,
    costBaselineComparison: input.costBaselineComparison ?? null,
  };
}

export function toAdminRecommendationView(input: {
  recordId: string | null;
  version: number | null;
  result: BestPayRecommendationResult | null;
  stale: boolean;
}): AdminRecommendationView {
  const result = input.result;

  const toAdminCandidate = (
    candidate: import('../domain/recommendation/bestPaySolutionCandidate').BestPaySolutionCandidate,
    scoreBreakdown: import('../domain/recommendation/bestPaySolutionCandidate').RecommendationScoreBreakdown | null,
  ): AdminRecommendationCandidateView => ({
    ...toSalesCandidateView(candidate),
    candidateCode: candidate.candidateCode,
    scoreBreakdown,
    exclusionReasons: candidate.exclusionReasons,
    pricingReviewClass: candidate.pricingEvaluation?.reviewClass ?? null,
    commissionStatus: candidate.commissionPreview?.status ?? null,
    expectedCommissionCents:
      candidate.commissionPreview?.finalExpectedCommissionAmountCents ?? null,
  });

  if (!result) {
    return {
      recordId: input.recordId,
      version: input.version,
      status: 'draft',
      stale: input.stale,
      inputFingerprint: '',
      weightSetLabel: 'Keine veröffentlichte Konfiguration',
      tieBreakerUsed: null,
      commissionTieBreakerActive: false,
      primary: null,
      rankedCandidates: [],
      blockedCandidates: [],
      excludedCandidates: [],
      alternatives: [],
      primaryReasons: [],
      findings: [],
      snapshotEvaluatedAt: null,
    };
  }

  return {
    recordId: input.recordId,
    version: input.version,
    status: result.status,
    stale: input.stale,
    inputFingerprint: result.inputFingerprint,
    weightSetLabel: result.snapshot.weightSet
      ? `Version ${result.snapshot.weightSet.versionNumber} (${result.snapshot.weightSet.status})`
      : 'Keine veröffentlichte Konfiguration',
    tieBreakerUsed: result.snapshot.tieBreakerUsed,
    commissionTieBreakerActive: result.snapshot.commissionTieBreakerActive,
    primary: result.primaryCandidate
      ? toAdminCandidate(
          result.primaryCandidate,
          result.scoredCandidates.find(
            (entry) => entry.candidate.candidateId === result.primaryCandidate!.candidateId,
          )?.scoreBreakdown ?? null,
        )
      : null,
    rankedCandidates: result.scoredCandidates.map((entry) =>
      toAdminCandidate(entry.candidate, entry.scoreBreakdown),
    ),
    blockedCandidates: result.blockedCandidates.map((candidate) =>
      toAdminCandidate(candidate, null),
    ),
    excludedCandidates: result.excludedCandidates.map((candidate) =>
      toAdminCandidate(candidate, null),
    ),
    alternatives: result.alternatives,
    primaryReasons: result.primaryReasons,
    findings: result.findings,
    snapshotEvaluatedAt: result.snapshot.evaluatedAt,
  };
}
