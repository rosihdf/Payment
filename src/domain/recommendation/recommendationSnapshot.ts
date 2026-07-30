import type { CustomerNeed } from './customerNeed';
import type { BestPaySolutionCandidate, RecommendationScoreBreakdown } from './bestPaySolutionCandidate';
import type { RecommendationFinding } from './recommendationFinding';
import type { RecommendationReason } from './recommendationReason';
import type { RecommendationWeightSet } from './recommendationWeightSet';
import type { BestPayRecommendationResult } from './recommendationResult';

export interface RecommendationSnapshotCatalogVersions {
  tariffCatalogVersion: number | null;
  productCatalogVersion: number | null;
  pricingCatalogVersion: number | null;
  commissionCatalogVersion: number | null;
  recommendationCatalogVersion: number | null;
}

export interface RecommendationSnapshot {
  schemaVersion: number;
  engineVersion: string;
  evaluatedAt: string;
  inputFingerprint: string;

  normalizedNeed: CustomerNeed;
  catalogVersions: RecommendationSnapshotCatalogVersions;
  weightSet: RecommendationWeightSet | null;

  candidates: BestPaySolutionCandidate[];
  blockedCandidates: BestPaySolutionCandidate[];
  excludedCandidates: BestPaySolutionCandidate[];

  scoreBreakdowns: Record<string, RecommendationScoreBreakdown>;
  rankingOrder: string[];

  primaryCandidateId: string | null;
  alternativeCandidateIds: string[];
  reasons: RecommendationReason[];

  findings: RecommendationFinding[];
  tieBreakerUsed: string | null;
  commissionTieBreakerActive: boolean;
}

export function createRecommendationSnapshotFromResult(
  result: BestPayRecommendationResult,
  catalogVersions: RecommendationSnapshotCatalogVersions,
  weightSet: RecommendationWeightSet | null,
  tieBreakerUsed: string | null,
  commissionTieBreakerActive: boolean,
): RecommendationSnapshot {
  const scoreBreakdowns: Record<string, RecommendationScoreBreakdown> = {};
  for (const scored of result.scoredCandidates) {
    scoreBreakdowns[scored.candidate.candidateId] = scored.scoreBreakdown;
  }

  return {
    schemaVersion: 1,
    engineVersion: result.engineVersion,
    evaluatedAt: result.createdAt,
    inputFingerprint: result.inputFingerprint,
    normalizedNeed: result.normalizedNeed,
    catalogVersions,
    weightSet,
    candidates: result.scoredCandidates.map((entry) => entry.candidate),
    blockedCandidates: result.blockedCandidates,
    excludedCandidates: result.excludedCandidates,
    scoreBreakdowns,
    rankingOrder: result.scoredCandidates.map((entry) => entry.candidate.candidateId),
    primaryCandidateId: result.primaryCandidate?.candidateId ?? null,
    alternativeCandidateIds: result.alternatives.map((alt) => alt.candidate.candidateId),
    reasons: result.primaryReasons,
    findings: result.findings,
    tieBreakerUsed,
    commissionTieBreakerActive,
  };
}
