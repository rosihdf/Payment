import type { SalesActivity } from '../../domain/salesWorkspace/salesActivity';

export interface SalesActivityRepository {
  getAll(): Promise<SalesActivity[]>;
  getById(id: string): Promise<SalesActivity | null>;
  create(activity: SalesActivity): Promise<SalesActivity>;
  update(activity: SalesActivity): Promise<SalesActivity>;
  delete(id: string): Promise<boolean>;
}
