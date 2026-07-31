import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_AUDIT_STORAGE_VERSION = 1;

export function migrateAuditStorageIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.auditStorageVersion) ?? 0;
  if (currentVersion >= CURRENT_AUDIT_STORAGE_VERSION) {
    return;
  }

  if (!readStorageItem(STORAGE_KEYS.auditEntries)) {
    writeStorageItem(STORAGE_KEYS.auditEntries, []);
  }

  writeStorageItem(STORAGE_KEYS.auditStorageVersion, CURRENT_AUDIT_STORAGE_VERSION);
}

export function resetAuditStorageForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.auditEntries);
  localStorage.removeItem(STORAGE_KEYS.auditStorageVersion);
}
