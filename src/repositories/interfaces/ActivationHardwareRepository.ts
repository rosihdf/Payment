import type { ActivationHardwareAssignment } from '../../domain/activation/activationHardware';

export interface ActivationHardwareRepository {
  getAll(): Promise<ActivationHardwareAssignment[]>;
  getByActivationId(activationId: string): Promise<ActivationHardwareAssignment[]>;
  getById(id: string): Promise<ActivationHardwareAssignment | null>;
  create(assignment: ActivationHardwareAssignment): Promise<ActivationHardwareAssignment>;
  createMany(assignments: ActivationHardwareAssignment[]): Promise<ActivationHardwareAssignment[]>;
  update(assignment: ActivationHardwareAssignment): Promise<ActivationHardwareAssignment>;
}
