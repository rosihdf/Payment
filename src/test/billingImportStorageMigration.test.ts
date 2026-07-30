import { beforeEach, describe, expect, it } from 'vitest';
import { migrateBillingImportStorageIfNeeded } from '../services/billingImportStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

describe('billingImportStorageMigration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initialisiert leere Billing-Import-Keys idempotent', () => {
    migrateBillingImportStorageIfNeeded();
    migrateBillingImportStorageIfNeeded();

    expect(readStorageItem(STORAGE_KEYS.billingImportSessions)).toEqual([]);
    expect(readStorageItem(STORAGE_KEYS.customerCostBaselines)).toEqual([]);
    expect(readStorageItem(STORAGE_KEYS.billingImportStorageVersion)).toBe(2);
    expect(readStorageItem(STORAGE_KEYS.billingCostLineItems)).toEqual([]);
  });

  it('behält bestehende Sessions bei', () => {
    writeStorageItem(STORAGE_KEYS.billingImportSessions, [{ id: 'session_1' }]);
    migrateBillingImportStorageIfNeeded();
    expect(readStorageItem(STORAGE_KEYS.billingImportSessions)).toEqual([{ id: 'session_1' }]);
  });
});
