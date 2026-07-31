import type { ActivationApplication } from '../../domain/activation/activationApplication';
import { normalizeActivationApplications } from '../../domain/activation/normalizeActivation';
import { migrateActivationStorageIfNeeded } from '../../services/activationStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ActivationApplicationRepository } from '../interfaces/ActivationApplicationRepository';

export class LocalActivationApplicationRepository implements ActivationApplicationRepository {
  private readAll(): ActivationApplication[] {
    migrateActivationStorageIfNeeded();
    return normalizeActivationApplications(readStorageItem<unknown[]>(STORAGE_KEYS.activationApplications) ?? []);
  }

  private writeAll(values: ActivationApplication[]): void {
    migrateActivationStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.activationApplications, values);
  }

  async getAll(): Promise<ActivationApplication[]> {
    return this.readAll();
  }

  async getByActivationId(activationId: string): Promise<ActivationApplication[]> {
    return this.readAll().filter((entry) => entry.activationId === activationId);
  }

  async getById(id: string): Promise<ActivationApplication | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async create(application: ActivationApplication): Promise<ActivationApplication> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === application.id)) {
      throw new Error(`ActivationApplication already exists: ${application.id}`);
    }
    all.push(application);
    this.writeAll(all);
    return application;
  }

  async update(application: ActivationApplication): Promise<ActivationApplication> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === application.id);
    if (index < 0) {
      throw new Error(`ActivationApplication not found: ${application.id}`);
    }
    all[index] = application;
    this.writeAll(all);
    return application;
  }
}
