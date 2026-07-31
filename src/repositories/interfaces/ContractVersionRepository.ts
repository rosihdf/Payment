import type { ContractVersion } from '../../domain/contract/contractVersion';

export interface ContractVersionRepository {
  getAll(): Promise<ContractVersion[]>;
  getById(id: string): Promise<ContractVersion | null>;
  getByContractId(contractId: string): Promise<ContractVersion[]>;
  create(version: ContractVersion): Promise<ContractVersion>;
  update(version: ContractVersion): Promise<ContractVersion>;
}
