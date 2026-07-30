import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_RECOMMENDATION_CATALOG_VERSION = 1;
export const CURRENT_RECOMMENDATION_STORAGE_VERSION = 1;

export function migrateRecommendationCatalogIfNeeded(): void {
  const currentVersion =
    readStorageItem<number>(STORAGE_KEYS.recommendationCatalogVersion) ?? 0;

  if (currentVersion >= CURRENT_RECOMMENDATION_CATALOG_VERSION) {
    return;
  }

  if (!readStorageItem(STORAGE_KEYS.recommendationWeightSets)) {
    writeStorageItem(STORAGE_KEYS.recommendationWeightSets, []);
  }

  writeStorageItem(
    STORAGE_KEYS.recommendationCatalogVersion,
    CURRENT_RECOMMENDATION_CATALOG_VERSION,
  );
}

export function migrateRecommendationStorageIfNeeded(): void {
  const currentVersion =
    readStorageItem<number>(STORAGE_KEYS.recommendationStorageVersion) ?? 0;

  if (currentVersion >= CURRENT_RECOMMENDATION_STORAGE_VERSION) {
    return;
  }

  if (!readStorageItem(STORAGE_KEYS.recommendationRecords)) {
    writeStorageItem(STORAGE_KEYS.recommendationRecords, []);
  }

  writeStorageItem(
    STORAGE_KEYS.recommendationStorageVersion,
    CURRENT_RECOMMENDATION_STORAGE_VERSION,
  );
}

export function resetRecommendationStorageForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.recommendationRecords);
  localStorage.removeItem(STORAGE_KEYS.recommendationWeightSets);
  localStorage.removeItem(STORAGE_KEYS.recommendationCatalogVersion);
  localStorage.removeItem(STORAGE_KEYS.recommendationStorageVersion);
}
