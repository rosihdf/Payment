import type { ActivationCase } from '../../domain/activation/activationCase';
import { normalizeActivationCases } from '../../domain/activation/normalizeActivation';
import { migrateActivationStorageIfNeeded } from '../../services/activationStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ActivationCaseRepository } from '../interfaces/ActivationCaseRepository';

export class LocalActivationCaseRepository implements ActivationCaseRepository {
  private readAll(): ActivationCase[] {
    migrateActivationStorageIfNeeded();
    return normalizeActivationCases(readStorageItem<unknown[]>(STORAGE_KEYS.activationCases) ?? []);
  }

  private writeAll(values: ActivationCase[]): void {
    migrateActivationStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.activationCases, values);
  }

  async getAll(): Promise<ActivationCase[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<ActivationCase | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async getBySourceKey(sourceKey: string): Promise<ActivationCase | null> {
    return this.readAll().find((entry) => entry.sourceKey === sourceKey) ?? null;
  }

  async getByContractId(contractId: string): Promise<ActivationCase | null> {
    return this.readAll().find((entry) => entry.contractId === contractId) ?? null;
  }

  async create(activationCase: ActivationCase): Promise<ActivationCase> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === activationCase.id)) {
      throw new Error(`ActivationCase already exists: ${activationCase.id}`);
    }
    all.push(activationCase);
    this.writeAll(all);
    return activationCase;
  }

  async update(activationCase: ActivationCase): Promise<ActivationCase> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === activationCase.id);
    if (index < 0) {
      throw new Error(`ActivationCase not found: ${activationCase.id}`);
    }
    all[index] = activationCase;
    this.writeAll(all);
    return activationCase;
  }
}
