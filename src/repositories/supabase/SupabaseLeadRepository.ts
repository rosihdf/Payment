import type { Lead } from '../../domain/lead/lead';
import { normalizeLead, normalizeLeads } from '../../domain/lead/normalizeLead';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { LeadNotFoundError } from '../errors/LeadNotFoundError';
import type { LeadRepository } from '../interfaces/LeadRepository';

interface LeadRow {
  id: string;
  company_name: string;
  status: string;
  assigned_sales_user_id: string;
  created_by_user_id: string;
  data: unknown;
  created_at: string;
  updated_at: string;
}

function leadToRow(lead: Lead): LeadRow {
  const normalized = normalizeLead(lead);
  return {
    id: normalized.id,
    company_name: normalized.companyName,
    status: normalized.status,
    assigned_sales_user_id: normalized.assignedSalesUserId,
    created_by_user_id: normalized.createdByUserId,
    data: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function rowToLead(row: LeadRow): Lead {
  return normalizeLead(row.data ?? {
    id: row.id,
    companyName: row.company_name,
    status: row.status,
    assignedSalesUserId: row.assigned_sales_user_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SupabaseLeadRepository implements LeadRepository {
  async getAll(): Promise<Lead[]> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('leads').select('*').order('updated_at', { ascending: false });
    if (error) {
      throw new Error(`Leads laden fehlgeschlagen: ${error.message}`);
    }
    return normalizeLeads((data as LeadRow[]).map((row) => rowToLead(row)));
  }

  async getById(id: string): Promise<Lead | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('leads').select('*').eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Lead laden fehlgeschlagen: ${error.message}`);
    }
    return data ? rowToLead(data as LeadRow) : null;
  }

  async count(): Promise<number> {
    const client = getSupabaseClient();
    const { count, error } = await client.from('leads').select('*', { count: 'exact', head: true });
    if (error) {
      throw new Error(`Lead-Zählung fehlgeschlagen: ${error.message}`);
    }
    return count ?? 0;
  }

  async create(lead: Lead): Promise<Lead> {
    const client = getSupabaseClient();
    const row = leadToRow(lead);
    const { data, error } = await client.from('leads').insert(row).select('*').single();
    if (error) {
      throw new Error(`Lead anlegen fehlgeschlagen: ${error.message}`);
    }
    return rowToLead(data as LeadRow);
  }

  async update(lead: Lead): Promise<Lead> {
    const existing = await this.getById(lead.id);
    if (!existing) {
      throw new LeadNotFoundError(lead.id);
    }

    const client = getSupabaseClient();
    const row = leadToRow(lead);
    const { data, error } = await client.from('leads').update(row).eq('id', lead.id).select('*').single();
    if (error) {
      throw new Error(`Lead aktualisieren fehlgeschlagen: ${error.message}`);
    }
    return rowToLead(data as LeadRow);
  }
}
