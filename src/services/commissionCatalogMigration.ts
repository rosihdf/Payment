import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_COMMISSION_CATALOG_VERSION = 1;

export function migrateCommissionCatalogIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.commissionCatalogVersion) ?? 0;

  if (currentVersion >= CURRENT_COMMISSION_CATALOG_VERSION) {
    return;
  }

  if (!readStorageItem(STORAGE_KEYS.commissionPlans)) {
    writeStorageItem(STORAGE_KEYS.commissionPlans, []);
  }

  if (!readStorageItem(STORAGE_KEYS.commissionPlanVersions)) {
    writeStorageItem(STORAGE_KEYS.commissionPlanVersions, []);
  }

  if (!readStorageItem(STORAGE_KEYS.commissionRules)) {
    writeStorageItem(STORAGE_KEYS.commissionRules, []);
  }

  if (!readStorageItem(STORAGE_KEYS.commissionAssignments)) {
    writeStorageItem(STORAGE_KEYS.commissionAssignments, []);
  }

  writeStorageItem(STORAGE_KEYS.commissionCatalogVersion, CURRENT_COMMISSION_CATALOG_VERSION);
}

export function resetCommissionCatalogForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.commissionCatalogVersion);
  localStorage.removeItem(STORAGE_KEYS.commissionPlans);
  localStorage.removeItem(STORAGE_KEYS.commissionPlanVersions);
  localStorage.removeItem(STORAGE_KEYS.commissionRules);
  localStorage.removeItem(STORAGE_KEYS.commissionAssignments);
}
