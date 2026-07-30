import { normalizeOffers } from '../domain/offer/normalizeOffer';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_OFFER_STORAGE_VERSION = 1;

export function migrateOfferStorageIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.offerStorageVersion) ?? 0;

  if (currentVersion >= CURRENT_OFFER_STORAGE_VERSION) {
    return;
  }

  const rawOffers = readStorageItem<unknown[]>(STORAGE_KEYS.offers) ?? [];
  const normalizedOffers = normalizeOffers(rawOffers);

  writeStorageItem(STORAGE_KEYS.offers, normalizedOffers);
  writeStorageItem(STORAGE_KEYS.offerStorageVersion, CURRENT_OFFER_STORAGE_VERSION);
}

export function resetOfferStorageVersionForTests(): void {
  writeStorageItem(STORAGE_KEYS.offerStorageVersion, 0);
}
