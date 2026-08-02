import { normalizeBestPayHandoffs } from '../domain/offer/normalizeBestPayHandoff';
import { normalizeOfferCustomerAcceptances } from '../domain/offer/normalizeOfferCustomerAcceptance';
import { normalizeOfferShares } from '../domain/offer/normalizeOfferShare';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_SALES_PROCESS_STORAGE_VERSION = 1;

export function migrateSalesProcessStorageIfNeeded(): void {
  const version = readStorageItem<number>(STORAGE_KEYS.salesProcessStorageVersion) ?? 0;
  if (version >= CURRENT_SALES_PROCESS_STORAGE_VERSION) {
    return;
  }

  writeStorageItem(
    STORAGE_KEYS.offerShares,
    normalizeOfferShares(readStorageItem<unknown[]>(STORAGE_KEYS.offerShares) ?? []),
  );
  writeStorageItem(
    STORAGE_KEYS.offerCustomerAcceptances,
    normalizeOfferCustomerAcceptances(
      readStorageItem<unknown[]>(STORAGE_KEYS.offerCustomerAcceptances) ?? [],
    ),
  );
  writeStorageItem(
    STORAGE_KEYS.bestPayHandoffs,
    normalizeBestPayHandoffs(readStorageItem<unknown[]>(STORAGE_KEYS.bestPayHandoffs) ?? []),
  );
  writeStorageItem(STORAGE_KEYS.salesProcessStorageVersion, CURRENT_SALES_PROCESS_STORAGE_VERSION);
}
