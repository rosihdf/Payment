import type { SalesTask } from '../../domain/salesWorkspace/salesTask';
import {
  migrateSalesTaskStorageIfNeeded,
  normalizeSalesTask,
} from '../../services/salesWorkspaceStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { SalesTaskRepository } from '../interfaces/SalesTaskRepository';

export class LocalSalesTaskRepository implements SalesTaskRepository {
  private readAll(): SalesTask[] {
    migrateSalesTaskStorageIfNeeded();
    const raw = readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks) ?? [];
    return raw.map(normalizeSalesTask).filter((entry): entry is SalesTask => entry !== null);
  }

  private writeAll(tasks: SalesTask[]): void {
    migrateSalesTaskStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.salesTasks, tasks);
  }

  async getAll(): Promise<SalesTask[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<SalesTask | null> {
    return this.readAll().find((task) => task.id === id) ?? null;
  }

  async create(task: SalesTask): Promise<SalesTask> {
    const tasks = this.readAll();
    tasks.push(task);
    this.writeAll(tasks);
    return task;
  }

  async update(task: SalesTask): Promise<SalesTask> {
    const tasks = this.readAll();
    const index = tasks.findIndex((entry) => entry.id === task.id);
    if (index < 0) {
      throw new Error(`SalesTask not found: ${task.id}`);
    }
    tasks[index] = task;
    this.writeAll(tasks);
    return task;
  }

  async delete(id: string): Promise<boolean> {
    const tasks = this.readAll();
    const next = tasks.filter((task) => task.id !== id);
    if (next.length === tasks.length) {
      return false;
    }
    this.writeAll(next);
    return true;
  }
}
