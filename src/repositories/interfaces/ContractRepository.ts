import type { Contract } from '../../domain/contract/contract';

export interface ContractRepository {
  getAll(): Promise<Contract[]>;
  getById(id: string): Promise<Contract | null>;
  getBySourceKey(sourceKey: string): Promise<Contract | null>;
  getByOfferId(offerId: string): Promise<Contract | null>;
  create(contract: Contract): Promise<Contract>;
  update(contract: Contract): Promise<Contract>;
}
