import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_BILLING_IMPORT_STORAGE_VERSION = 2;

export function migrateBillingImportStorageIfNeeded(): void {
  const currentVersion =
    readStorageItem<number>(STORAGE_KEYS.billingImportStorageVersion) ?? 0;

  if (currentVersion >= CURRENT_BILLING_IMPORT_STORAGE_VERSION) {
    return;
  }

  if (!readStorageItem(STORAGE_KEYS.billingImportSessions)) {
    writeStorageItem(STORAGE_KEYS.billingImportSessions, []);
  }
  if (!readStorageItem(STORAGE_KEYS.billingSourceDocuments)) {
    writeStorageItem(STORAGE_KEYS.billingSourceDocuments, []);
  }
  if (!readStorageItem(STORAGE_KEYS.billingExtractedFields)) {
    writeStorageItem(STORAGE_KEYS.billingExtractedFields, []);
  }
  if (!readStorageItem(STORAGE_KEYS.billingPeriodRecords)) {
    writeStorageItem(STORAGE_KEYS.billingPeriodRecords, []);
  }
  if (!readStorageItem(STORAGE_KEYS.customerCostBaselines)) {
    writeStorageItem(STORAGE_KEYS.customerCostBaselines, []);
  }
  if (!readStorageItem(STORAGE_KEYS.billingCostLineItems)) {
    writeStorageItem(STORAGE_KEYS.billingCostLineItems, []);
  }

  writeStorageItem(
    STORAGE_KEYS.billingImportStorageVersion,
    CURRENT_BILLING_IMPORT_STORAGE_VERSION,
  );
}
