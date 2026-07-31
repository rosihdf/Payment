import { normalizeSalesDocuments } from '../../domain/salesDocument/normalizeSalesDocument';
import type { SalesDocument } from '../../domain/salesDocument/salesDocument';
import { migrateOfferWorkflowStorageIfNeeded } from '../../services/offerWorkflowStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { SalesDocumentRepository } from '../interfaces/SalesDocumentRepository';

export class LocalSalesDocumentRepository implements SalesDocumentRepository {
  private readAll(): SalesDocument[] {
    migrateOfferWorkflowStorageIfNeeded();
    return normalizeSalesDocuments(readStorageItem<unknown[]>(STORAGE_KEYS.salesDocuments) ?? []);
  }
  async getAll(): Promise<SalesDocument[]> { return this.readAll(); }
  async getByOfferId(offerId: string): Promise<SalesDocument[]> {
    return this.readAll().filter((entry) => entry.offerId === offerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async create(document: SalesDocument): Promise<SalesDocument> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === document.id)) return document;
    writeStorageItem(STORAGE_KEYS.salesDocuments, [...all, document]);
    return document;
  }
}
