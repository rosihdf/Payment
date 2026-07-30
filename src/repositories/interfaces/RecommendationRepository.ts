import type { RecommendationRecord } from '../../domain/recommendation/recommendationRecord';
import type { RecommendationWeightSet } from '../../domain/recommendation/recommendationWeightSet';

export interface RecommendationRepository {
  getRecords(): Promise<RecommendationRecord[]>;
  saveRecord(record: RecommendationRecord): Promise<void>;
  getWeightSets(): Promise<RecommendationWeightSet[]>;
  saveWeightSets(weightSets: RecommendationWeightSet[]): Promise<void>;
}
