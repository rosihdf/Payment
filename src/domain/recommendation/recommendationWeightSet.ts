export type RecommendationWeightSetStatus = 'draft' | 'published' | 'archived';

export type RecommendationTieBreakerKey =
  | 'fewer_critical_findings'
  | 'higher_completeness'
  | 'lower_total_cost'
  | 'better_term_fit'
  | 'fewer_special_cases'
  | 'internal_business'
  | 'candidate_code';

export interface RecommendationWeightSet {
  id: string;
  versionNumber: number;
  status: RecommendationWeightSetStatus;
  validFrom: string | null;
  validUntil: string | null;

  weights: {
    eligibilityScore: number;
    needFitScore: number;
    costScore: number;
    termScore: number;
    hardwareScore: number;
    riskScore: number;
    completenessScore: number;
    internalBusinessScore: number;
  };

  tieBreakers: RecommendationTieBreakerKey[];
  commissionTieBreakerEnabled: boolean;
  maxAlternatives: number;
  defaultProjectionMonths: number | null;

  createdByUserId: string;
  publishedByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_TIE_BREAKERS: RecommendationTieBreakerKey[] = [
  'fewer_critical_findings',
  'higher_completeness',
  'lower_total_cost',
  'better_term_fit',
  'fewer_special_cases',
  'candidate_code',
];
