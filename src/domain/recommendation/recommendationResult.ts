import type { CustomerNeed, NeedCompletenessStatus } from './customerNeed';
import type { BestPaySolutionCandidate, ScoredCandidate } from './bestPaySolutionCandidate';
import type { RecommendationFinding } from './recommendationFinding';
import type { RecommendationReason } from './recommendationReason';
import type { RecommendationSnapshot } from './recommendationSnapshot';

export type RecommendationResultStatus =
  | 'draft'
  | 'complete'
  | 'incomplete'
  | 'blocked'
  | 'stale'
  | 'frozen'
  | 'superseded';

export interface RecommendationAlternative {
  candidate: BestPaySolutionCandidate;
  rank: number;
  mainDifference: string;
  costDifferenceCents: number | null;
  termDifferenceMonths: number | null;
  hardwareDifference: string | null;
  riskLabel: string;
  suitabilityHint: string;
  reasons: RecommendationReason[];
}

export interface BestPayRecommendationResult {
  recommendationId: string;
  engineVersion: string;
  createdAt: string;

  leadId: string | null;
  offerId: string | null;
  inputFingerprint: string;
  status: RecommendationResultStatus;

  normalizedNeed: CustomerNeed;
  needCompleteness: NeedCompletenessStatus;

  scoredCandidates: ScoredCandidate[];
  blockedCandidates: BestPaySolutionCandidate[];
  excludedCandidates: BestPaySolutionCandidate[];

  primaryCandidate: BestPaySolutionCandidate | null;
  primaryRank: number | null;
  primaryReasons: RecommendationReason[];
  primaryAdvantages: string[];
  primaryLimitations: string[];
  requiredReviews: string[];

  alternatives: RecommendationAlternative[];

  findings: RecommendationFinding[];
  snapshot: RecommendationSnapshot;
  stale: boolean;
}

export const RECOMMENDATION_ENGINE_VERSION = '1.0.0';
export const RECOMMENDATION_SNAPSHOT_SCHEMA_VERSION = 1;
