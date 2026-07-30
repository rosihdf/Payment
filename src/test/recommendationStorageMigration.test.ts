import { describe, expect, it } from 'vitest';
import {
  CURRENT_RECOMMENDATION_STORAGE_VERSION,
  migrateRecommendationStorageIfNeeded,
  resetRecommendationStorageForTests,
} from '../services/recommendationStorageMigration';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';

describe('recommendation storage migration', () => {
  it('initialisiert leere Recommendation-Keys idempotent', () => {
    resetRecommendationStorageForTests();
    migrateRecommendationStorageIfNeeded();
    migrateRecommendationStorageIfNeeded();

    expect(readStorageItem(STORAGE_KEYS.recommendationRecords)).toEqual([]);
    expect(readStorageItem(STORAGE_KEYS.recommendationStorageVersion)).toBe(
      CURRENT_RECOMMENDATION_STORAGE_VERSION,
    );
  });
});
