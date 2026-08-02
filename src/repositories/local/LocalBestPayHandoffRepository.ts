import { normalizeBestPayHandoffs } from '../../domain/offer/normalizeBestPayHandoff';
import type { BestPayHandoff } from '../../domain/offer/bestPayHandoff';
import { migrateSalesProcessStorageIfNeeded } from '../../services/salesProcessStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { BestPayHandoffRepository } from '../interfaces/BestPayHandoffRepository';

export class LocalBestPayHandoffRepository implements BestPayHandoffRepository {
  private readAll(): BestPayHandoff[] {
    migrateSalesProcessStorageIfNeeded();
    return normalizeBestPayHandoffs(readStorageItem<unknown[]>(STORAGE_KEYS.bestPayHandoffs) ?? []);
  }

  private writeAll(values: BestPayHandoff[]): void {
    migrateSalesProcessStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.bestPayHandoffs, values);
  }

  async getAll(): Promise<BestPayHandoff[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<BestPayHandoff | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async getByOfferId(offerId: string): Promise<BestPayHandoff[]> {
    return this.readAll().filter((entry) => entry.offerId === offerId);
  }

  async getByOfferVersionId(offerVersionId: string): Promise<BestPayHandoff | null> {
    return this.readAll().find((entry) => entry.offerVersionId === offerVersionId) ?? null;
  }

  async create(handoff: BestPayHandoff): Promise<BestPayHandoff> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === handoff.id)) {
      throw new Error(`BestPayHandoff already exists: ${handoff.id}`);
    }
    all.push(handoff);
    this.writeAll(all);
    return handoff;
  }

  async update(handoff: BestPayHandoff): Promise<BestPayHandoff> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === handoff.id);
    if (index < 0) {
      throw new Error(`BestPayHandoff not found: ${handoff.id}`);
    }
    all[index] = handoff;
    this.writeAll(all);
    return handoff;
  }
}
