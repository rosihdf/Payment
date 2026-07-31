import type { ActivationChecklistItem } from '../../domain/activation/activationChecklist';
import { normalizeActivationChecklistItems } from '../../domain/activation/normalizeActivation';
import { migrateActivationStorageIfNeeded } from '../../services/activationStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ActivationChecklistRepository } from '../interfaces/ActivationChecklistRepository';

export class LocalActivationChecklistRepository implements ActivationChecklistRepository {
  private readAll(): ActivationChecklistItem[] {
    migrateActivationStorageIfNeeded();
    return normalizeActivationChecklistItems(readStorageItem<unknown[]>(STORAGE_KEYS.activationChecklists) ?? []);
  }

  private writeAll(values: ActivationChecklistItem[]): void {
    migrateActivationStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.activationChecklists, values);
  }

  async getAll(): Promise<ActivationChecklistItem[]> {
    return this.readAll();
  }

  async getByActivationId(activationId: string): Promise<ActivationChecklistItem[]> {
    return this.readAll()
      .filter((entry) => entry.activationId === activationId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getById(id: string): Promise<ActivationChecklistItem | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async create(item: ActivationChecklistItem): Promise<ActivationChecklistItem> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === item.id)) {
      throw new Error(`ActivationChecklistItem already exists: ${item.id}`);
    }
    all.push(item);
    this.writeAll(all);
    return item;
  }

  async createMany(items: ActivationChecklistItem[]): Promise<ActivationChecklistItem[]> {
    const all = this.readAll();
    const existingIds = new Set(all.map((entry) => entry.id));
    for (const item of items) {
      if (existingIds.has(item.id)) {
        throw new Error(`ActivationChecklistItem already exists: ${item.id}`);
      }
    }
    all.push(...items);
    this.writeAll(all);
    return items;
  }

  async update(item: ActivationChecklistItem): Promise<ActivationChecklistItem> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === item.id);
    if (index < 0) {
      throw new Error(`ActivationChecklistItem not found: ${item.id}`);
    }
    all[index] = item;
    this.writeAll(all);
    return item;
  }
}
