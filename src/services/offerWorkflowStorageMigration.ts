import { normalizeOfferWorkflowEvents } from '../domain/offer/normalizeOfferWorkflowEvents';
import { normalizeOfferVersions } from '../domain/offer/normalizeOfferVersion';
import { normalizeSalesDocuments } from '../domain/salesDocument/normalizeSalesDocument';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_OFFER_WORKFLOW_STORAGE_VERSION = 1;

export function migrateOfferWorkflowStorageIfNeeded(): void {
  const version = readStorageItem<number>(STORAGE_KEYS.offerWorkflowStorageVersion) ?? 0;
  if (version >= CURRENT_OFFER_WORKFLOW_STORAGE_VERSION) return;
  writeStorageItem(STORAGE_KEYS.offerVersions, normalizeOfferVersions(readStorageItem<unknown[]>(STORAGE_KEYS.offerVersions) ?? []));
  writeStorageItem(STORAGE_KEYS.offerApprovals, normalizeOfferWorkflowEvents(readStorageItem<unknown[]>(STORAGE_KEYS.offerApprovals) ?? []));
  writeStorageItem(STORAGE_KEYS.offerDispatches, normalizeOfferWorkflowEvents(readStorageItem<unknown[]>(STORAGE_KEYS.offerDispatches) ?? []));
  writeStorageItem(STORAGE_KEYS.offerAcceptances, normalizeOfferWorkflowEvents(readStorageItem<unknown[]>(STORAGE_KEYS.offerAcceptances) ?? []));
  writeStorageItem(STORAGE_KEYS.offerDeclines, normalizeOfferWorkflowEvents(readStorageItem<unknown[]>(STORAGE_KEYS.offerDeclines) ?? []));
  writeStorageItem(STORAGE_KEYS.offerActivations, normalizeOfferWorkflowEvents(readStorageItem<unknown[]>(STORAGE_KEYS.offerActivations) ?? []));
  writeStorageItem(STORAGE_KEYS.salesDocuments, normalizeSalesDocuments(readStorageItem<unknown[]>(STORAGE_KEYS.salesDocuments) ?? []));
  writeStorageItem(STORAGE_KEYS.offerWorkflowStorageVersion, CURRENT_OFFER_WORKFLOW_STORAGE_VERSION);
}
