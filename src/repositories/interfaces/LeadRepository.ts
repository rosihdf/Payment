import type { Lead } from '../../domain/lead/lead';

export interface LeadRepository {
  getAll(): Promise<Lead[]>;
  getById(id: string): Promise<Lead | null>;
  count(): Promise<number>;
  create(lead: Lead): Promise<Lead>;
  update(lead: Lead): Promise<Lead>;
}
