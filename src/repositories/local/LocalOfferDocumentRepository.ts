import type { OfferDocument } from '../../domain/offerDocument/offerDocument';
import {
  normalizeOfferDocument,
  normalizeOfferDocuments,
  stripBinaryFieldsFromDocument,
} from '../../domain/offerDocument/normalizeOfferDocument';
import { migrateOfferDocumentStorageIfNeeded } from '../../services/offerDocumentStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import { OfferDocumentConflictError } from '../errors/OfferDocumentConflictError';
import { OfferDocumentNotFoundError } from '../errors/OfferDocumentNotFoundError';
import type { OfferDocumentRepository } from '../interfaces/OfferDocumentRepository';

export class LocalOfferDocumentRepository implements OfferDocumentRepository {
  async getAll(): Promise<OfferDocument[]> {
    migrateOfferDocumentStorageIfNeeded();
    const rawDocuments = readStorageItem<unknown[]>(STORAGE_KEYS.offerDocuments) ?? [];
    const cleaned = rawDocuments.map((entry) => stripBinaryFieldsFromDocument(entry));
    return normalizeOfferDocuments(cleaned);
  }

  async getById(id: string): Promise<OfferDocument | null> {
    const documents = await this.getAll();
    return documents.find((document) => document.id === id) ?? null;
  }

  async getByOfferId(offerId: string): Promise<OfferDocument[]> {
    const documents = await this.getAll();
    return documents
      .filter((document) => document.offerId === offerId)
      .sort((left, right) => right.version - left.version);
  }

  async create(document: OfferDocument): Promise<OfferDocument> {
    const documents = await this.getAll();
    const normalizedDocument = normalizeOfferDocument(document);

    if (documents.some((item) => item.id === normalizedDocument.id)) {
      throw new OfferDocumentConflictError(
        'duplicate_id',
        `Offer document with id ${normalizedDocument.id} already exists`,
      );
    }

    if (documents.some((item) => item.documentNumber === normalizedDocument.documentNumber)) {
      throw new OfferDocumentConflictError(
        'duplicate_document_number',
        `Offer document number ${normalizedDocument.documentNumber} already exists`,
      );
    }

    if (
      documents.some(
        (item) =>
          item.offerId === normalizedDocument.offerId &&
          item.version === normalizedDocument.version,
      )
    ) {
      throw new OfferDocumentConflictError(
        'duplicate_version',
        `Offer document version ${normalizedDocument.version} already exists for offer`,
      );
    }

    writeStorageItem(STORAGE_KEYS.offerDocuments, [...documents, normalizedDocument]);
    return { ...normalizedDocument, snapshot: { ...normalizedDocument.snapshot } };
  }

  async markSuperseded(id: string): Promise<OfferDocument> {
    const documents = await this.getAll();
    const index = documents.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new OfferDocumentNotFoundError(id);
    }

    const current = documents[index]!;
    if (current.status === 'superseded') {
      return { ...current, snapshot: { ...current.snapshot } };
    }

    const updated: OfferDocument = {
      ...current,
      status: 'superseded',
      updatedAt: new Date().toISOString(),
    };

    const nextDocuments = [...documents];
    nextDocuments[index] = updated;
    writeStorageItem(STORAGE_KEYS.offerDocuments, nextDocuments);
    return { ...updated, snapshot: { ...updated.snapshot } };
  }
}
