import {
  normalizeRecommendationRecord,
  normalizeRecommendationRecords,
  normalizeRecommendationWeightSets,
} from '../../domain/recommendation/normalizeRecommendationRecord';
import type { RecommendationRecord } from '../../domain/recommendation/recommendationRecord';
import type { RecommendationWeightSet } from '../../domain/recommendation/recommendationWeightSet';
import {
  migrateRecommendationCatalogIfNeeded,
  migrateRecommendationStorageIfNeeded,
} from '../../services/recommendationStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { RecommendationRepository } from '../interfaces/RecommendationRepository';

export class LocalRecommendationRepository implements RecommendationRepository {
  private ensureMigrated(): void {
    migrateRecommendationCatalogIfNeeded();
    migrateRecommendationStorageIfNeeded();
  }

  async getRecords(): Promise<RecommendationRecord[]> {
    this.ensureMigrated();
    const raw = readStorageItem<unknown[]>(STORAGE_KEYS.recommendationRecords) ?? [];
    return normalizeRecommendationRecords(raw);
  }

  async saveRecord(record: RecommendationRecord): Promise<void> {
    this.ensureMigrated();
    const records = await this.getRecords();
    const index = records.findIndex((entry) => entry.id === record.id);
    const normalized = normalizeRecommendationRecord(record);

    if (index >= 0) {
      records[index] = normalized;
    } else {
      records.push(normalized);
    }

    writeStorageItem(STORAGE_KEYS.recommendationRecords, records);
  }

  async getWeightSets(): Promise<RecommendationWeightSet[]> {
    this.ensureMigrated();
    const raw = readStorageItem<unknown[]>(STORAGE_KEYS.recommendationWeightSets) ?? [];
    return normalizeRecommendationWeightSets(raw);
  }

  async saveWeightSets(weightSets: RecommendationWeightSet[]): Promise<void> {
    this.ensureMigrated();
    writeStorageItem(
      STORAGE_KEYS.recommendationWeightSets,
      normalizeRecommendationWeightSets(weightSets),
    );
  }
}
