import type { ContractTermination } from '../../domain/contract/contractTermination';

export interface ContractTerminationRepository {
  getAll(): Promise<ContractTermination[]>;
  getById(id: string): Promise<ContractTermination | null>;
  getByContractId(contractId: string): Promise<ContractTermination[]>;
  create(termination: ContractTermination): Promise<ContractTermination>;
  update(termination: ContractTermination): Promise<ContractTermination>;
}
