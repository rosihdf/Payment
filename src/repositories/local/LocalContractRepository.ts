import { normalizeContracts } from '../../domain/contract/normalizeContract';
import type { Contract } from '../../domain/contract/contract';
import { migrateContractStorageIfNeeded } from '../../services/contractStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ContractRepository } from '../interfaces/ContractRepository';

export class LocalContractRepository implements ContractRepository {
  private readAll(): Contract[] {
    migrateContractStorageIfNeeded();
    return normalizeContracts(readStorageItem<unknown[]>(STORAGE_KEYS.contracts) ?? []);
  }

  private writeAll(values: Contract[]): void {
    migrateContractStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.contracts, values);
  }

  async getAll(): Promise<Contract[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<Contract | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async getBySourceKey(sourceKey: string): Promise<Contract | null> {
    return this.readAll().find((entry) => entry.sourceKey === sourceKey) ?? null;
  }

  async getByOfferId(offerId: string): Promise<Contract | null> {
    return this.readAll().find((entry) => entry.sourceOfferId === offerId) ?? null;
  }

  async create(contract: Contract): Promise<Contract> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === contract.id)) {
      throw new Error(`Contract already exists: ${contract.id}`);
    }
    all.push(contract);
    this.writeAll(all);
    return contract;
  }

  async update(contract: Contract): Promise<Contract> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === contract.id);
    if (index < 0) {
      throw new Error(`Contract not found: ${contract.id}`);
    }
    all[index] = contract;
    this.writeAll(all);
    return contract;
  }
}
