import type { RecommendationSnapshot } from './recommendationSnapshot';
import type { RecommendationResultStatus } from './recommendationResult';

export type RecommendationRecordStatus = RecommendationResultStatus;

export type RecommendationSelectionType = 'primary' | 'alternative';

export interface RecommendationSelection {
  recommendationRecordId: string;
  recommendationVersion: number;
  selectedCandidateId: string;
  selectionType: RecommendationSelectionType;
  isDeviation: boolean;
  deviationReason: string;
  selectedByUserId: string;
  selectedAt: string;
}

export interface RecommendationRecord {
  id: string;
  leadId: string | null;
  offerId: string | null;
  version: number;
  status: RecommendationRecordStatus;
  inputFingerprint: string;
  snapshot: RecommendationSnapshot;
  primaryCandidateId: string | null;
  selectedCandidateId: string | null;
  selection: RecommendationSelection | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  frozenAt: string | null;
  supersededAt: string | null;
}

export interface OfferRecommendationLink {
  recommendationRecordId: string | null;
  recommendationVersion: number | null;
  selectedCandidateId: string | null;
  selectionType: RecommendationSelectionType | null;
  deviationReason: string;
  costBaselineId: string | null;
  costBaselineVersion: number | null;
}

export const EMPTY_OFFER_RECOMMENDATION_LINK: OfferRecommendationLink = {
  recommendationRecordId: null,
  recommendationVersion: null,
  selectedCandidateId: null,
  selectionType: null,
  deviationReason: '',
  costBaselineId: null,
  costBaselineVersion: null,
};
