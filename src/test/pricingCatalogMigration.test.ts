import { describe, expect, it } from 'vitest';
import { migratePricingCatalogIfNeeded, resetPricingCatalogVersionForTests } from '../services/pricingCatalogMigration';
import { STORAGE_KEYS, readStorageItem } from '../utils/storage';

describe('pricing catalog migration', () => {
  it('initializes empty catalog without invented prices', () => {
    resetPricingCatalogVersionForTests();
    migratePricingCatalogIfNeeded();

    expect(readStorageItem(STORAGE_KEYS.priceBooks)).toEqual([]);
    expect(readStorageItem(STORAGE_KEYS.priceBookVersions)).toEqual([]);
    expect(readStorageItem(STORAGE_KEYS.contractTerms)).toEqual([]);
    expect(readStorageItem(STORAGE_KEYS.priceRules)).toEqual([]);
  });
});
