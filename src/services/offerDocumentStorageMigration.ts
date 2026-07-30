import {
  normalizeOfferDocuments,
  stripBinaryFieldsFromDocument,
} from '../domain/offerDocument/normalizeOfferDocument';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_OFFER_DOCUMENT_STORAGE_VERSION = 1;

export function migrateOfferDocumentStorageIfNeeded(): void {
  const currentVersion =
    readStorageItem<number>(STORAGE_KEYS.offerDocumentStorageVersion) ?? 0;

  if (currentVersion >= CURRENT_OFFER_DOCUMENT_STORAGE_VERSION) {
    return;
  }

  const rawDocuments = readStorageItem<unknown[]>(STORAGE_KEYS.offerDocuments) ?? [];
  const cleaned = rawDocuments.map((entry) => stripBinaryFieldsFromDocument(entry));
  const normalizedDocuments = normalizeOfferDocuments(cleaned);

  writeStorageItem(STORAGE_KEYS.offerDocuments, normalizedDocuments);
  writeStorageItem(
    STORAGE_KEYS.offerDocumentStorageVersion,
    CURRENT_OFFER_DOCUMENT_STORAGE_VERSION,
  );
}

export function resetOfferDocumentStorageVersionForTests(): void {
  writeStorageItem(STORAGE_KEYS.offerDocumentStorageVersion, 0);
}
