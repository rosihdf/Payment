import {
  normalizeContracts,
  normalizeContractTerminations,
  normalizeContractVersions,
} from '../domain/contract/normalizeContract';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_CONTRACT_STORAGE_VERSION = 1;

/** Idempotent: normalizes/repairs contract stores and stamps the current storage version. */
export function migrateContractStorageIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.contractStorageVersion) ?? 0;

  if (currentVersion >= CURRENT_CONTRACT_STORAGE_VERSION) {
    return;
  }

  const contracts = normalizeContracts(readStorageItem<unknown[]>(STORAGE_KEYS.contracts) ?? []);
  const versions = normalizeContractVersions(readStorageItem<unknown[]>(STORAGE_KEYS.contractVersions) ?? []);
  const terminations = normalizeContractTerminations(
    readStorageItem<unknown[]>(STORAGE_KEYS.contractTerminations) ?? [],
  );

  writeStorageItem(STORAGE_KEYS.contracts, contracts);
  writeStorageItem(STORAGE_KEYS.contractVersions, versions);
  writeStorageItem(STORAGE_KEYS.contractTerminations, terminations);
  writeStorageItem(STORAGE_KEYS.contractStorageVersion, CURRENT_CONTRACT_STORAGE_VERSION);
}

export function resetContractStorageVersionForTests(): void {
  writeStorageItem(STORAGE_KEYS.contractStorageVersion, 0);
}
