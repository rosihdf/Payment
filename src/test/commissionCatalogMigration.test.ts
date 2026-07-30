import { describe, expect, it } from 'vitest';
import { migrateCommissionCatalogIfNeeded, resetCommissionCatalogForTests } from '../services/commissionCatalogMigration';
import { STORAGE_KEYS, readStorageItem } from '../utils/storage';

describe('commission catalog migration', () => {
  it('initializes empty catalog without invented commission values', () => {
    resetCommissionCatalogForTests();
    migrateCommissionCatalogIfNeeded();

    expect(readStorageItem(STORAGE_KEYS.commissionPlans)).toEqual([]);
    expect(readStorageItem(STORAGE_KEYS.commissionPlanVersions)).toEqual([]);
    expect(readStorageItem(STORAGE_KEYS.commissionRules)).toEqual([]);
    expect(readStorageItem(STORAGE_KEYS.commissionAssignments)).toEqual([]);
  });
});
