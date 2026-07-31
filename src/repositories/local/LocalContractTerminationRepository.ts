import { normalizeContractTerminations } from '../../domain/contract/normalizeContract';
import type { ContractTermination } from '../../domain/contract/contractTermination';
import { migrateContractStorageIfNeeded } from '../../services/contractStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ContractTerminationRepository } from '../interfaces/ContractTerminationRepository';

export class LocalContractTerminationRepository implements ContractTerminationRepository {
  private readAll(): ContractTermination[] {
    migrateContractStorageIfNeeded();
    return normalizeContractTerminations(
      readStorageItem<unknown[]>(STORAGE_KEYS.contractTerminations) ?? [],
    );
  }

  private writeAll(values: ContractTermination[]): void {
    migrateContractStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.contractTerminations, values);
  }

  async getAll(): Promise<ContractTermination[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<ContractTermination | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async getByContractId(contractId: string): Promise<ContractTermination[]> {
    return this.readAll()
      .filter((entry) => entry.contractId === contractId)
      .sort((a, b) => b.documentedAt.localeCompare(a.documentedAt));
  }

  async create(termination: ContractTermination): Promise<ContractTermination> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === termination.id)) {
      throw new Error(`ContractTermination already exists: ${termination.id}`);
    }
    all.push(termination);
    this.writeAll(all);
    return termination;
  }

  async update(termination: ContractTermination): Promise<ContractTermination> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === termination.id);
    if (index < 0) {
      throw new Error(`ContractTermination not found: ${termination.id}`);
    }
    all[index] = termination;
    this.writeAll(all);
    return termination;
  }
}
