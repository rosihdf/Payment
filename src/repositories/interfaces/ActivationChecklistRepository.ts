import type { ActivationChecklistItem } from '../../domain/activation/activationChecklist';

export interface ActivationChecklistRepository {
  getAll(): Promise<ActivationChecklistItem[]>;
  getByActivationId(activationId: string): Promise<ActivationChecklistItem[]>;
  getById(id: string): Promise<ActivationChecklistItem | null>;
  create(item: ActivationChecklistItem): Promise<ActivationChecklistItem>;
  createMany(items: ActivationChecklistItem[]): Promise<ActivationChecklistItem[]>;
  update(item: ActivationChecklistItem): Promise<ActivationChecklistItem>;
}
