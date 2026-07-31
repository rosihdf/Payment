import type { ActivationBlocker } from '../../domain/activation/activationBlocker';
import { normalizeActivationBlockers } from '../../domain/activation/normalizeActivation';
import { migrateActivationStorageIfNeeded } from '../../services/activationStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ActivationBlockerRepository } from '../interfaces/ActivationBlockerRepository';

export class LocalActivationBlockerRepository implements ActivationBlockerRepository {
  private readAll(): ActivationBlocker[] {
    migrateActivationStorageIfNeeded();
    return normalizeActivationBlockers(readStorageItem<unknown[]>(STORAGE_KEYS.activationBlockers) ?? []);
  }

  private writeAll(values: ActivationBlocker[]): void {
    migrateActivationStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.activationBlockers, values);
  }

  async getAll(): Promise<ActivationBlocker[]> {
    return this.readAll();
  }

  async getByActivationId(activationId: string): Promise<ActivationBlocker[]> {
    return this.readAll().filter((entry) => entry.activationId === activationId);
  }

  async getById(id: string): Promise<ActivationBlocker | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async create(blocker: ActivationBlocker): Promise<ActivationBlocker> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === blocker.id)) {
      throw new Error(`ActivationBlocker already exists: ${blocker.id}`);
    }
    all.push(blocker);
    this.writeAll(all);
    return blocker;
  }

  async update(blocker: ActivationBlocker): Promise<ActivationBlocker> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === blocker.id);
    if (index < 0) {
      throw new Error(`ActivationBlocker not found: ${blocker.id}`);
    }
    all[index] = blocker;
    this.writeAll(all);
    return blocker;
  }
}
