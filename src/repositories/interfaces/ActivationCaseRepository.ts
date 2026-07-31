import type { ActivationCase } from '../../domain/activation/activationCase';

export interface ActivationCaseRepository {
  getAll(): Promise<ActivationCase[]>;
  getById(id: string): Promise<ActivationCase | null>;
  getBySourceKey(sourceKey: string): Promise<ActivationCase | null>;
  getByContractId(contractId: string): Promise<ActivationCase | null>;
  create(activationCase: ActivationCase): Promise<ActivationCase>;
  update(activationCase: ActivationCase): Promise<ActivationCase>;
}
