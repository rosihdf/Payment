import { normalizeContractVersions } from '../../domain/contract/normalizeContract';
import type { ContractVersion } from '../../domain/contract/contractVersion';
import { migrateContractStorageIfNeeded } from '../../services/contractStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ContractVersionRepository } from '../interfaces/ContractVersionRepository';

export class LocalContractVersionRepository implements ContractVersionRepository {
  private readAll(): ContractVersion[] {
    migrateContractStorageIfNeeded();
    return normalizeContractVersions(readStorageItem<unknown[]>(STORAGE_KEYS.contractVersions) ?? []);
  }

  private writeAll(values: ContractVersion[]): void {
    migrateContractStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.contractVersions, values);
  }

  async getAll(): Promise<ContractVersion[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<ContractVersion | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async getByContractId(contractId: string): Promise<ContractVersion[]> {
    return this.readAll()
      .filter((entry) => entry.contractId === contractId)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  async create(version: ContractVersion): Promise<ContractVersion> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === version.id)) {
      throw new Error(`ContractVersion already exists: ${version.id}`);
    }
    all.push(version);
    this.writeAll(all);
    return version;
  }

  async update(version: ContractVersion): Promise<ContractVersion> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === version.id);
    if (index < 0) {
      throw new Error(`ContractVersion not found: ${version.id}`);
    }
    all[index] = version;
    this.writeAll(all);
    return version;
  }
}
