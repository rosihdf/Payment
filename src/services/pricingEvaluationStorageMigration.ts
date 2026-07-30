import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_PRICING_EVALUATION_STORAGE_VERSION = 1;

export function migratePricingEvaluationStorageIfNeeded(): void {
  const currentVersion =
    readStorageItem<number>(STORAGE_KEYS.pricingEvaluationStorageVersion) ?? 0;

  if (currentVersion >= CURRENT_PRICING_EVALUATION_STORAGE_VERSION) {
    return;
  }

  if (!readStorageItem(STORAGE_KEYS.pricingEvaluations)) {
    writeStorageItem(STORAGE_KEYS.pricingEvaluations, []);
  }

  writeStorageItem(
    STORAGE_KEYS.pricingEvaluationStorageVersion,
    CURRENT_PRICING_EVALUATION_STORAGE_VERSION,
  );
}

export function resetPricingEvaluationStorageForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.pricingEvaluationStorageVersion);
  localStorage.removeItem(STORAGE_KEYS.pricingEvaluations);
}
