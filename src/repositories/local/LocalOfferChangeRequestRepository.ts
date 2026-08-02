import { normalizeOfferChangeRequests } from '../../domain/offer/normalizeOfferChangeRequest';
import type { OfferChangeRequest } from '../../domain/offer/offerChangeRequest';
import { migrateSalesProcessStorageIfNeeded } from '../../services/salesProcessStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { OfferChangeRequestRepository } from '../interfaces/OfferChangeRequestRepository';

export class LocalOfferChangeRequestRepository implements OfferChangeRequestRepository {
  private readAll(): OfferChangeRequest[] {
    migrateSalesProcessStorageIfNeeded();
    return normalizeOfferChangeRequests(
      readStorageItem<unknown[]>(STORAGE_KEYS.offerChangeRequests) ?? [],
    );
  }

  private writeAll(values: OfferChangeRequest[]): void {
    migrateSalesProcessStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.offerChangeRequests, values);
  }

  async getAll(): Promise<OfferChangeRequest[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<OfferChangeRequest | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async getByOfferId(offerId: string): Promise<OfferChangeRequest[]> {
    return this.readAll().filter((entry) => entry.offerId === offerId);
  }

  async getByOfferVersionId(offerVersionId: string): Promise<OfferChangeRequest[]> {
    return this.readAll().filter((entry) => entry.offerVersionId === offerVersionId);
  }

  async create(request: OfferChangeRequest): Promise<OfferChangeRequest> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === request.id)) {
      throw new Error(`OfferChangeRequest already exists: ${request.id}`);
    }
    all.push(request);
    this.writeAll(all);
    return request;
  }

  async update(request: OfferChangeRequest): Promise<OfferChangeRequest> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === request.id);
    if (index < 0) {
      throw new Error(`OfferChangeRequest not found: ${request.id}`);
    }
    all[index] = request;
    this.writeAll(all);
    return request;
  }
}
