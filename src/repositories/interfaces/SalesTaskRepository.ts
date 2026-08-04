import type { SalesTask } from '../../domain/salesWorkspace/salesTask';

export interface SalesTaskRepository {
  getAll(): Promise<SalesTask[]>;
  getById(id: string): Promise<SalesTask | null>;
  getBySourceKey(sourceKey: string): Promise<SalesTask | null>;
  create(task: SalesTask): Promise<SalesTask>;
  update(task: SalesTask): Promise<SalesTask>;
  delete(id: string): Promise<boolean>;
}
