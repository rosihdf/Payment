import type { ActivationApplication } from '../../domain/activation/activationApplication';

export interface ActivationApplicationRepository {
  getAll(): Promise<ActivationApplication[]>;
  getByActivationId(activationId: string): Promise<ActivationApplication[]>;
  getById(id: string): Promise<ActivationApplication | null>;
  create(application: ActivationApplication): Promise<ActivationApplication>;
  update(application: ActivationApplication): Promise<ActivationApplication>;
}
