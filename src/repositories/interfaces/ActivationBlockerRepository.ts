import type { ActivationBlocker } from '../../domain/activation/activationBlocker';

export interface ActivationBlockerRepository {
  getAll(): Promise<ActivationBlocker[]>;
  getByActivationId(activationId: string): Promise<ActivationBlocker[]>;
  getById(id: string): Promise<ActivationBlocker | null>;
  create(blocker: ActivationBlocker): Promise<ActivationBlocker>;
  update(blocker: ActivationBlocker): Promise<ActivationBlocker>;
}
