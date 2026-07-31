import type { SalesActivity } from '../../domain/salesWorkspace/salesActivity';
import {
  migrateSalesActivityStorageIfNeeded,
  normalizeSalesActivity,
} from '../../services/salesWorkspaceStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { SalesActivityRepository } from '../interfaces/SalesActivityRepository';

export class LocalSalesActivityRepository implements SalesActivityRepository {
  private readAll(): SalesActivity[] {
    migrateSalesActivityStorageIfNeeded();
    const raw = readStorageItem<unknown[]>(STORAGE_KEYS.salesActivities) ?? [];
    return raw
      .map(normalizeSalesActivity)
      .filter((entry): entry is SalesActivity => entry !== null);
  }

  private writeAll(activities: SalesActivity[]): void {
    migrateSalesActivityStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.salesActivities, activities);
  }

  async getAll(): Promise<SalesActivity[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<SalesActivity | null> {
    return this.readAll().find((activity) => activity.id === id) ?? null;
  }

  async create(activity: SalesActivity): Promise<SalesActivity> {
    const activities = this.readAll();
    activities.push(activity);
    this.writeAll(activities);
    return activity;
  }

  async update(activity: SalesActivity): Promise<SalesActivity> {
    const activities = this.readAll();
    const index = activities.findIndex((entry) => entry.id === activity.id);
    if (index < 0) {
      throw new Error(`SalesActivity not found: ${activity.id}`);
    }
    activities[index] = activity;
    this.writeAll(activities);
    return activity;
  }

  async delete(id: string): Promise<boolean> {
    const activities = this.readAll();
    const next = activities.filter((activity) => activity.id !== id);
    if (next.length === activities.length) {
      return false;
    }
    this.writeAll(next);
    return true;
  }
}
