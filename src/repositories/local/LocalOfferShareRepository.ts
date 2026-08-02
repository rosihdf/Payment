import { normalizeOfferShares } from '../../domain/offer/normalizeOfferShare';
import type { OfferShare } from '../../domain/offer/offerShare';
import { migrateSalesProcessStorageIfNeeded } from '../../services/salesProcessStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { OfferShareRepository } from '../interfaces/OfferShareRepository';

export class LocalOfferShareRepository implements OfferShareRepository {
  private readAll(): OfferShare[] {
    migrateSalesProcessStorageIfNeeded();
    return normalizeOfferShares(readStorageItem<unknown[]>(STORAGE_KEYS.offerShares) ?? []);
  }

  private writeAll(values: OfferShare[]): void {
    migrateSalesProcessStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.offerShares, values);
  }

  async getAll(): Promise<OfferShare[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<OfferShare | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async getByOfferId(offerId: string): Promise<OfferShare[]> {
    return this.readAll().filter((entry) => entry.offerId === offerId);
  }

  async getByOfferVersionId(offerVersionId: string): Promise<OfferShare[]> {
    return this.readAll().filter((entry) => entry.offerVersionId === offerVersionId);
  }

  async getByTokenHash(tokenHash: string): Promise<OfferShare | null> {
    return this.readAll().find((entry) => entry.tokenHash === tokenHash) ?? null;
  }

  async create(share: OfferShare): Promise<OfferShare> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === share.id)) {
      throw new Error(`OfferShare already exists: ${share.id}`);
    }
    all.push(share);
    this.writeAll(all);
    return share;
  }

  async update(share: OfferShare): Promise<OfferShare> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === share.id);
    if (index < 0) {
      throw new Error(`OfferShare not found: ${share.id}`);
    }
    all[index] = share;
    this.writeAll(all);
    return share;
  }
}
