import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_PRICING_CATALOG_VERSION = 1;

export function migratePricingCatalogIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.pricingCatalogVersion) ?? 0;

  if (currentVersion >= CURRENT_PRICING_CATALOG_VERSION) {
    return;
  }

  if (!readStorageItem(STORAGE_KEYS.priceBooks)) {
    writeStorageItem(STORAGE_KEYS.priceBooks, []);
  }

  if (!readStorageItem(STORAGE_KEYS.priceBookVersions)) {
    writeStorageItem(STORAGE_KEYS.priceBookVersions, []);
  }

  if (!readStorageItem(STORAGE_KEYS.contractTerms)) {
    writeStorageItem(STORAGE_KEYS.contractTerms, []);
  }

  if (!readStorageItem(STORAGE_KEYS.priceRules)) {
    writeStorageItem(STORAGE_KEYS.priceRules, []);
  }

  writeStorageItem(STORAGE_KEYS.pricingCatalogVersion, CURRENT_PRICING_CATALOG_VERSION);
}

export function resetPricingCatalogVersionForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.pricingCatalogVersion);
  localStorage.removeItem(STORAGE_KEYS.priceBooks);
  localStorage.removeItem(STORAGE_KEYS.priceBookVersions);
  localStorage.removeItem(STORAGE_KEYS.contractTerms);
  localStorage.removeItem(STORAGE_KEYS.priceRules);
}
