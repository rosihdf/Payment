import type { Lead } from '../../domain/lead/lead';
import { normalizeLead, normalizeLeads } from '../../domain/lead/normalizeLead';
import { LeadNotFoundError } from '../errors/LeadNotFoundError';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { LeadRepository } from '../interfaces/LeadRepository';

export class LocalLeadRepository implements LeadRepository {
  async getAll(): Promise<Lead[]> {
    const rawLeads = readStorageItem<unknown[]>(STORAGE_KEYS.leads) ?? [];
    return normalizeLeads(rawLeads);
  }

  async getById(id: string): Promise<Lead | null> {
    const leads = await this.getAll();
    return leads.find((lead) => lead.id === id) ?? null;
  }

  async count(): Promise<number> {
    const leads = await this.getAll();
    return leads.length;
  }

  async create(lead: Lead): Promise<Lead> {
    const leads = await this.getAll();
    const normalizedLead = normalizeLead(lead);
    writeStorageItem(STORAGE_KEYS.leads, [...leads, normalizedLead]);
    return normalizedLead;
  }

  async update(lead: Lead): Promise<Lead> {
    const leads = await this.getAll();
    const index = leads.findIndex((item) => item.id === lead.id);

    if (index === -1) {
      throw new LeadNotFoundError(lead.id);
    }

    const normalizedLead = normalizeLead(lead);
    const updatedLeads = [...leads];
    updatedLeads[index] = normalizedLead;
    writeStorageItem(STORAGE_KEYS.leads, updatedLeads);
    return normalizedLead;
  }
}
