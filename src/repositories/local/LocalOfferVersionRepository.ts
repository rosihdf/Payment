import { normalizeOfferVersions } from '../../domain/offer/normalizeOfferVersion';
import type { OfferVersion } from '../../domain/offer/offerVersion';
import { migrateOfferWorkflowStorageIfNeeded } from '../../services/offerWorkflowStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { OfferVersionRepository } from '../interfaces/OfferVersionRepository';

export class LocalOfferVersionRepository implements OfferVersionRepository {
  private readAll(): OfferVersion[] {
    migrateOfferWorkflowStorageIfNeeded();
    return normalizeOfferVersions(readStorageItem<unknown[]>(STORAGE_KEYS.offerVersions) ?? []);
  }
  private writeAll(values: OfferVersion[]): void {
    migrateOfferWorkflowStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.offerVersions, values);
  }
  async getAll(): Promise<OfferVersion[]> { return this.readAll(); }
  async getById(id: string): Promise<OfferVersion | null> { return this.readAll().find((entry) => entry.id === id) ?? null; }
  async getByOfferId(offerId: string): Promise<OfferVersion[]> {
    return this.readAll().filter((entry) => entry.offerId === offerId).sort((a, b) => a.versionNumber - b.versionNumber);
  }
  async create(version: OfferVersion): Promise<OfferVersion> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === version.id)) throw new Error(`OfferVersion already exists: ${version.id}`);
    all.push(version); this.writeAll(all); return version;
  }
  async update(version: OfferVersion): Promise<OfferVersion> {
    const all = this.readAll(); const index = all.findIndex((entry) => entry.id === version.id);
    if (index < 0) throw new Error(`OfferVersion not found: ${version.id}`);
    all[index] = version; this.writeAll(all); return version;
  }
}
