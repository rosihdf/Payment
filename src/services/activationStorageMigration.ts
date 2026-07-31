import {
  normalizeActivationApplications,
  normalizeActivationBlockers,
  normalizeActivationCases,
  normalizeActivationChecklistItems,
  normalizeActivationHardwareList,
} from '../domain/activation/normalizeActivation';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_ACTIVATION_STORAGE_VERSION = 1;

/** Idempotent: normalizes/repairs activation stores and stamps the current storage version. */
export function migrateActivationStorageIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.activationStorageVersion) ?? 0;

  if (currentVersion >= CURRENT_ACTIVATION_STORAGE_VERSION) {
    return;
  }

  const cases = normalizeActivationCases(readStorageItem<unknown[]>(STORAGE_KEYS.activationCases) ?? []);
  const checklists = normalizeActivationChecklistItems(
    readStorageItem<unknown[]>(STORAGE_KEYS.activationChecklists) ?? [],
  );
  const applications = normalizeActivationApplications(
    readStorageItem<unknown[]>(STORAGE_KEYS.activationApplications) ?? [],
  );
  const hardware = normalizeActivationHardwareList(
    readStorageItem<unknown[]>(STORAGE_KEYS.activationHardware) ?? [],
  );
  const blockers = normalizeActivationBlockers(
    readStorageItem<unknown[]>(STORAGE_KEYS.activationBlockers) ?? [],
  );

  writeStorageItem(STORAGE_KEYS.activationCases, cases);
  writeStorageItem(STORAGE_KEYS.activationChecklists, checklists);
  writeStorageItem(STORAGE_KEYS.activationApplications, applications);
  writeStorageItem(STORAGE_KEYS.activationHardware, hardware);
  writeStorageItem(STORAGE_KEYS.activationBlockers, blockers);
  writeStorageItem(STORAGE_KEYS.activationStorageVersion, CURRENT_ACTIVATION_STORAGE_VERSION);
}

export function resetActivationStorageVersionForTests(): void {
  writeStorageItem(STORAGE_KEYS.activationStorageVersion, 0);
}
