import { normalizeOfferVersions } from '../domain/offer/normalizeOfferVersion';
import { normalizeOfferWorkflowEvents } from '../domain/offer/normalizeOfferWorkflowEvents';
import { normalizeOfferDocuments } from '../domain/offerDocument/normalizeOfferDocument';
import { normalizePricingEvaluationRecords } from '../domain/pricing/normalizePricingEvaluationRecord';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function filterStorageArray<T>(
  key: string,
  predicate: (entry: T) => boolean,
): void {
  const raw = readStorageItem<unknown[]>(key) ?? [];
  writeStorageItem(
    key,
    raw.filter((entry) => predicate(entry as T)),
  );
}

function filterNormalizedStorage<T>(
  key: string,
  normalize: (values: unknown[]) => T[],
  predicate: (entry: T) => boolean,
): void {
  const raw = readStorageItem<unknown[]>(key) ?? [];
  const kept = normalize(raw).filter((entry) => predicate(entry));
  writeStorageItem(key, kept);
}

/** Entfernt lokale Draft-Artefakte – nur für echte Entwürfe ohne Folgeobjekte. */
export function purgeLocalOfferDraftArtifacts(offerId: string): void {
  filterNormalizedStorage(
    STORAGE_KEYS.offerVersions,
    (values) => normalizeOfferVersions(values),
    (entry) => entry.offerId !== offerId,
  );

  for (const key of [
    STORAGE_KEYS.offerApprovals,
    STORAGE_KEYS.offerDispatches,
    STORAGE_KEYS.offerAcceptances,
    STORAGE_KEYS.offerDeclines,
    STORAGE_KEYS.offerActivations,
    STORAGE_KEYS.offerCounselingConfirmations,
    STORAGE_KEYS.offerFollowUpPreferences,
  ]) {
    filterNormalizedStorage(
      key,
      (values) => normalizeOfferWorkflowEvents(values),
      (entry) => entry.offerId !== offerId,
    );
  }

  filterNormalizedStorage(
    STORAGE_KEYS.offerDocuments,
    (values) => normalizeOfferDocuments(values),
    (entry) => entry.offerId !== offerId,
  );

  filterStorageArray<{ offerId?: string }>(STORAGE_KEYS.offerShares, (entry) => entry.offerId !== offerId);
  filterStorageArray<{ offerId?: string }>(
    STORAGE_KEYS.offerCustomerQuestions,
    (entry) => entry.offerId !== offerId,
  );
  filterStorageArray<{ offerId?: string }>(
    STORAGE_KEYS.offerChangeRequests,
    (entry) => entry.offerId !== offerId,
  );
  filterStorageArray<{ offerId?: string }>(
    STORAGE_KEYS.offerCustomerAcceptances,
    (entry) => entry.offerId !== offerId,
  );

  filterNormalizedStorage(
    STORAGE_KEYS.pricingEvaluations,
    (values) => normalizePricingEvaluationRecords(values),
    (entry) => entry.offerId !== offerId,
  );

  filterStorageArray<{ offerId?: string }>(
    STORAGE_KEYS.commissionCalculations,
    (entry) => entry.offerId !== offerId,
  );

  filterStorageArray<{ offerId?: string }>(STORAGE_KEYS.commissionCases, (entry) => entry.offerId !== offerId);

  filterStorageArray<{ offerId?: string | null }>(
    STORAGE_KEYS.salesTasks,
    (entry) => entry.offerId !== offerId,
  );
  filterStorageArray<{ offerId?: string | null }>(
    STORAGE_KEYS.salesActivities,
    (entry) => entry.offerId !== offerId,
  );
}
