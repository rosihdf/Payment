import type { Tariff } from '../../domain/tariff/tariff';
import { normalizeTariff, normalizeTariffs } from '../../domain/tariff/normalizeTariff';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { TariffNotFoundError } from '../errors/TariffNotFoundError';
import type { TariffRepository } from '../interfaces/TariffRepository';

interface TariffRow {
  id: string;
  name: string;
  product_code: string;
  status: string;
  data: unknown;
  created_at: string;
  updated_at: string;
}

function tariffToRow(tariff: Tariff): TariffRow {
  const normalized = normalizeTariff(tariff);
  return {
    id: normalized.id,
    name: normalized.name,
    product_code: normalized.productCode,
    status: normalized.status,
    data: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function rowToTariff(row: TariffRow): Tariff {
  return normalizeTariff(row.data ?? {
    id: row.id,
    name: row.name,
    productCode: row.product_code,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SupabaseTariffRepository implements TariffRepository {
  async getAll(): Promise<Tariff[]> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('tariffs').select('*').order('name');
    if (error) {
      throw new Error(`Tarife laden fehlgeschlagen: ${error.message}`);
    }
    return normalizeTariffs((data as TariffRow[]).map((row) => rowToTariff(row)));
  }

  async getById(id: string): Promise<Tariff | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('tariffs').select('*').eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Tarif laden fehlgeschlagen: ${error.message}`);
    }
    return data ? rowToTariff(data as TariffRow) : null;
  }

  async count(): Promise<number> {
    const client = getSupabaseClient();
    const { count, error } = await client.from('tariffs').select('*', { count: 'exact', head: true });
    if (error) {
      throw new Error(`Tarif-Zählung fehlgeschlagen: ${error.message}`);
    }
    return count ?? 0;
  }

  async create(tariff: Tariff): Promise<Tariff> {
    const client = getSupabaseClient();
    const row = tariffToRow(tariff);
    const { data, error } = await client.from('tariffs').insert(row).select('*').single();
    if (error) {
      throw new Error(`Tarif anlegen fehlgeschlagen: ${error.message}`);
    }
    return rowToTariff(data as TariffRow);
  }

  async update(tariff: Tariff): Promise<Tariff> {
    const existing = await this.getById(tariff.id);
    if (!existing) {
      throw new TariffNotFoundError(tariff.id);
    }

    const client = getSupabaseClient();
    const row = tariffToRow(tariff);
    const { data, error } = await client
      .from('tariffs')
      .update(row)
      .eq('id', tariff.id)
      .select('*')
      .single();
    if (error) {
      throw new Error(`Tarif aktualisieren fehlgeschlagen: ${error.message}`);
    }
    return rowToTariff(data as TariffRow);
  }
}
