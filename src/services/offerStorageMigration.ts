import { normalizeOffers } from '../domain/offer/normalizeOffer';
import { buildOfferVersionSnapshot } from '../domain/offer/buildOfferVersionSnapshot';
import { normalizeOfferVersions } from '../domain/offer/normalizeOfferVersion';
import { migrateOfferWorkflowStorageIfNeeded } from './offerWorkflowStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_OFFER_STORAGE_VERSION = 3;

export function migrateOfferStorageIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.offerStorageVersion) ?? 0;

  if (currentVersion >= CURRENT_OFFER_STORAGE_VERSION) {
    return;
  }

  const rawOffers = readStorageItem<unknown[]>(STORAGE_KEYS.offers) ?? [];
  const normalizedOffers = normalizeOffers(rawOffers);
  migrateOfferWorkflowStorageIfNeeded();
  const versions = normalizeOfferVersions(readStorageItem<unknown[]>(STORAGE_KEYS.offerVersions) ?? []);
  for (const offer of normalizedOffers) {
    const existing = versions
      .filter((entry) => entry.offerId === offer.id)
      .sort((left, right) => right.versionNumber - left.versionNumber)[0];
    if (!existing) {
      const initial = {
        id: `offer_version_migrated_${offer.id}`,
        offerId: offer.id,
        versionNumber: 1,
        workflowStatus: offer.workflowStatus,
        snapshot: buildOfferVersionSnapshot(offer),
        createdAt: offer.createdAt,
        createdByUserId: offer.createdByUserId,
        createdByDisplayName: offer.createdByDisplayName,
        approvedAt: null, approvedByUserId: null, sentAt: null, acceptedAt: null,
        declinedAt: null, activatedAt: null, supersededAt: null,
      };
      versions.push(initial);
      offer.currentVersionNumber = 1;
      offer.currentVersionId = initial.id;
    } else {
      offer.currentVersionNumber = existing.versionNumber;
      offer.currentVersionId = existing.id;
    }
  }

  writeStorageItem(STORAGE_KEYS.offers, normalizedOffers);
  writeStorageItem(STORAGE_KEYS.offerVersions, versions);
  writeStorageItem(STORAGE_KEYS.offerStorageVersion, CURRENT_OFFER_STORAGE_VERSION);
}

export function resetOfferStorageVersionForTests(): void {
  writeStorageItem(STORAGE_KEYS.offerStorageVersion, 0);
}
