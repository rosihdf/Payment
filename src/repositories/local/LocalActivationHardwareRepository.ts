import type { ActivationHardwareAssignment } from '../../domain/activation/activationHardware';
import { normalizeActivationHardwareList } from '../../domain/activation/normalizeActivation';
import { migrateActivationStorageIfNeeded } from '../../services/activationStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { ActivationHardwareRepository } from '../interfaces/ActivationHardwareRepository';

export class LocalActivationHardwareRepository implements ActivationHardwareRepository {
  private readAll(): ActivationHardwareAssignment[] {
    migrateActivationStorageIfNeeded();
    return normalizeActivationHardwareList(readStorageItem<unknown[]>(STORAGE_KEYS.activationHardware) ?? []);
  }

  private writeAll(values: ActivationHardwareAssignment[]): void {
    migrateActivationStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.activationHardware, values);
  }

  async getAll(): Promise<ActivationHardwareAssignment[]> {
    return this.readAll();
  }

  async getByActivationId(activationId: string): Promise<ActivationHardwareAssignment[]> {
    return this.readAll().filter((entry) => entry.activationId === activationId);
  }

  async getById(id: string): Promise<ActivationHardwareAssignment | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async create(assignment: ActivationHardwareAssignment): Promise<ActivationHardwareAssignment> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === assignment.id)) {
      throw new Error(`ActivationHardwareAssignment already exists: ${assignment.id}`);
    }
    all.push(assignment);
    this.writeAll(all);
    return assignment;
  }

  async createMany(assignments: ActivationHardwareAssignment[]): Promise<ActivationHardwareAssignment[]> {
    const all = this.readAll();
    const existingIds = new Set(all.map((entry) => entry.id));
    for (const assignment of assignments) {
      if (existingIds.has(assignment.id)) {
        throw new Error(`ActivationHardwareAssignment already exists: ${assignment.id}`);
      }
    }
    all.push(...assignments);
    this.writeAll(all);
    return assignments;
  }

  async update(assignment: ActivationHardwareAssignment): Promise<ActivationHardwareAssignment> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === assignment.id);
    if (index < 0) {
      throw new Error(`ActivationHardwareAssignment not found: ${assignment.id}`);
    }
    all[index] = assignment;
    this.writeAll(all);
    return assignment;
  }
}
