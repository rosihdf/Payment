import { normalizeOfferCustomerAcceptances } from '../../domain/offer/normalizeOfferCustomerAcceptance';
import type { OfferCustomerAcceptance } from '../../domain/offer/offerCustomerAcceptance';
import { migrateSalesProcessStorageIfNeeded } from '../../services/salesProcessStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { OfferCustomerAcceptanceRepository } from '../interfaces/OfferCustomerAcceptanceRepository';

export class LocalOfferCustomerAcceptanceRepository implements OfferCustomerAcceptanceRepository {
  private readAll(): OfferCustomerAcceptance[] {
    migrateSalesProcessStorageIfNeeded();
    return normalizeOfferCustomerAcceptances(
      readStorageItem<unknown[]>(STORAGE_KEYS.offerCustomerAcceptances) ?? [],
    );
  }

  private writeAll(values: OfferCustomerAcceptance[]): void {
    migrateSalesProcessStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.offerCustomerAcceptances, values);
  }

  async getAll(): Promise<OfferCustomerAcceptance[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<OfferCustomerAcceptance | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async getByOfferId(offerId: string): Promise<OfferCustomerAcceptance[]> {
    return this.readAll().filter((entry) => entry.offerId === offerId);
  }

  async getByOfferVersionId(offerVersionId: string): Promise<OfferCustomerAcceptance | null> {
    return this.readAll().find((entry) => entry.offerVersionId === offerVersionId) ?? null;
  }

  async create(acceptance: OfferCustomerAcceptance): Promise<OfferCustomerAcceptance> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === acceptance.id)) {
      throw new Error(`OfferCustomerAcceptance already exists: ${acceptance.id}`);
    }
    if (all.some((entry) => entry.offerVersionId === acceptance.offerVersionId)) {
      throw new Error(`OfferCustomerAcceptance already exists for version: ${acceptance.offerVersionId}`);
    }
    all.push(acceptance);
    this.writeAll(all);
    return acceptance;
  }
}
