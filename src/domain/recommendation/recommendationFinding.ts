export type RecommendationFindingSeverity = 'info' | 'warning' | 'error' | 'blocking';

export type RecommendationFindingCategory =
  | 'input'
  | 'catalog'
  | 'eligibility'
  | 'pricing'
  | 'cost'
  | 'hardware'
  | 'term'
  | 'scoring'
  | 'commission'
  | 'override'
  | 'lifecycle'
  | 'permission';

export const RECOMMENDATION_FINDING_CODES = {
  RECOMMENDATION_INPUT_INCOMPLETE: 'RECOMMENDATION_INPUT_INCOMPLETE',
  RECOMMENDATION_NO_ELIGIBLE_CANDIDATE: 'RECOMMENDATION_NO_ELIGIBLE_CANDIDATE',
  RECOMMENDATION_CANDIDATE_BLOCKED: 'RECOMMENDATION_CANDIDATE_BLOCKED',
  RECOMMENDATION_CATALOG_EMPTY: 'RECOMMENDATION_CATALOG_EMPTY',
  RECOMMENDATION_RULE_CONFLICT: 'RECOMMENDATION_RULE_CONFLICT',
  RECOMMENDATION_COST_INCOMPLETE: 'RECOMMENDATION_COST_INCOMPLETE',
  RECOMMENDATION_COST_NOT_COMPARABLE: 'RECOMMENDATION_COST_NOT_COMPARABLE',
  RECOMMENDATION_HARDWARE_MISMATCH: 'RECOMMENDATION_HARDWARE_MISMATCH',
  RECOMMENDATION_TERM_MISMATCH: 'RECOMMENDATION_TERM_MISMATCH',
  RECOMMENDATION_REQUIRED_PRODUCT_MISSING: 'RECOMMENDATION_REQUIRED_PRODUCT_MISSING',
  RECOMMENDATION_PRICING_BLOCKED: 'RECOMMENDATION_PRICING_BLOCKED',
  RECOMMENDATION_COMMISSION_INCOMPLETE: 'RECOMMENDATION_COMMISSION_INCOMPLETE',
  RECOMMENDATION_SCORE_CONFIGURATION_MISSING: 'RECOMMENDATION_SCORE_CONFIGURATION_MISSING',
  RECOMMENDATION_SCORE_AMBIGUOUS: 'RECOMMENDATION_SCORE_AMBIGUOUS',
  RECOMMENDATION_OVERRIDE_REASON_REQUIRED: 'RECOMMENDATION_OVERRIDE_REASON_REQUIRED',
  RECOMMENDATION_OVERRIDE_NOT_ALLOWED: 'RECOMMENDATION_OVERRIDE_NOT_ALLOWED',
  RECOMMENDATION_STALE: 'RECOMMENDATION_STALE',
  RECOMMENDATION_SNAPSHOT_OUTDATED: 'RECOMMENDATION_SNAPSHOT_OUTDATED',
} as const;

export type RecommendationFindingCode =
  (typeof RECOMMENDATION_FINDING_CODES)[keyof typeof RECOMMENDATION_FINDING_CODES];

export interface RecommendationFinding {
  code: RecommendationFindingCode;
  severity: RecommendationFindingSeverity;
  category: RecommendationFindingCategory;
  candidateId: string | null;
  blocking: boolean;
  internalDescription: string;
  salesDescription: string | null;
  requiredAction: string | null;
  context: Record<string, string | number | boolean | null>;
}

export function createRecommendationFinding(
  partial: Omit<RecommendationFinding, 'context'> & {
    context?: RecommendationFinding['context'];
  },
): RecommendationFinding {
  return {
    ...partial,
    context: partial.context ?? {},
  };
}
