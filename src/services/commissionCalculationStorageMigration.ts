import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_COMMISSION_CALCULATION_STORAGE_VERSION = 1;

export function migrateCommissionCalculationStorageIfNeeded(): void {
  const currentVersion =
    readStorageItem<number>(STORAGE_KEYS.commissionCalculationStorageVersion) ?? 0;

  if (currentVersion >= CURRENT_COMMISSION_CALCULATION_STORAGE_VERSION) {
    return;
  }

  if (!readStorageItem(STORAGE_KEYS.commissionCalculations)) {
    writeStorageItem(STORAGE_KEYS.commissionCalculations, []);
  }

  if (!readStorageItem(STORAGE_KEYS.commissionCases)) {
    writeStorageItem(STORAGE_KEYS.commissionCases, []);
  }

  if (!readStorageItem(STORAGE_KEYS.commissionEvents)) {
    writeStorageItem(STORAGE_KEYS.commissionEvents, []);
  }

  writeStorageItem(
    STORAGE_KEYS.commissionCalculationStorageVersion,
    CURRENT_COMMISSION_CALCULATION_STORAGE_VERSION,
  );
}

export function resetCommissionCalculationStorageForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.commissionCalculationStorageVersion);
  localStorage.removeItem(STORAGE_KEYS.commissionCalculations);
  localStorage.removeItem(STORAGE_KEYS.commissionCases);
  localStorage.removeItem(STORAGE_KEYS.commissionEvents);
}
