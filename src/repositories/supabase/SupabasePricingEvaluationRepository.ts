import {
  normalizePricingEvaluationRecord,
  normalizePricingEvaluationRecords,
} from '../../domain/pricing/normalizePricingEvaluationRecord';
import type { PricingEvaluationRecord } from '../../domain/pricing/pricingEvaluationRecord';
import type { PricingEvaluationRepository } from '../interfaces/PricingEvaluationRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'pricing_evaluations';

function recordToRow(record: PricingEvaluationRecord): Record<string, unknown> {
  const normalized = normalizePricingEvaluationRecord(record);
  return {
    id: normalized.id,
    offer_id: normalized.offerId,
    created_by_user_id: normalized.createdByUserId,
    data: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function rowToRecord(row: JsonTableRow): PricingEvaluationRecord {
  return normalizePricingEvaluationRecord(
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export class SupabasePricingEvaluationRepository implements PricingEvaluationRepository {
  async getAll(): Promise<PricingEvaluationRecord[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizePricingEvaluationRecords(rows.map((row) => rowToRecord(row)));
  }

  async getByOfferId(offerId: string): Promise<PricingEvaluationRecord[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizePricingEvaluationRecords(rows.map((row) => rowToRecord(row)));
  }

  async getById(id: string): Promise<PricingEvaluationRecord | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToRecord(row) : null;
  }

  async create(record: PricingEvaluationRecord): Promise<PricingEvaluationRecord> {
    const row = await sbInsert(TABLE, recordToRow(record));
    return { ...rowToRecord(row) };
  }

  async update(record: PricingEvaluationRecord): Promise<PricingEvaluationRecord> {
    const existing = await this.getById(record.id);
    if (!existing) {
      throw new Error(`Pricing evaluation ${record.id} not found`);
    }
    const row = await sbUpdate(TABLE, record.id, recordToRow(record));
    return { ...rowToRecord(row) };
  }
}
