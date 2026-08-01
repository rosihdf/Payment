import {
  DEFAULT_TIE_BREAKERS,
  type RecommendationWeightSet,
} from '../recommendation/recommendationWeightSet';

/** Produktive Ausgangskonfiguration – stabile ID für idempotenten Bootstrap. */
export const PRODUCTION_RECOMMENDATION_WEIGHT_SET_ID = 'rec_weight_set_production_v1';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function createProductionRecommendationWeightSet(
  createdByUserId: string,
): RecommendationWeightSet {
  return {
    id: PRODUCTION_RECOMMENDATION_WEIGHT_SET_ID,
    versionNumber: 1,
    status: 'published',
    validFrom: '2026-01-01',
    validUntil: null,
    weights: {
      eligibilityScore: 100,
      needFitScore: 80,
      costScore: 90,
      termScore: 50,
      hardwareScore: 40,
      riskScore: 70,
      completenessScore: 60,
      internalBusinessScore: 10,
    },
    tieBreakers: DEFAULT_TIE_BREAKERS,
    commissionTieBreakerEnabled: false,
    maxAlternatives: 2,
    defaultProjectionMonths: 24,
    createdByUserId,
    publishedByUserId: createdByUserId,
    publishedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}
