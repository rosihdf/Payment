import {
  normalizeRecommendationRecord,
  normalizeRecommendationRecords,
  normalizeRecommendationWeightSets,
} from '../../domain/recommendation/normalizeRecommendationRecord';
import type { RecommendationRecord } from '../../domain/recommendation/recommendationRecord';
import type { RecommendationWeightSet } from '../../domain/recommendation/recommendationWeightSet';
import type { RecommendationRepository } from '../interfaces/RecommendationRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbUpdate,
  sbUpsertMany,
  type JsonTableRow,
} from './supabaseTable';

const RECORDS_TABLE = 'recommendation_records';
const WEIGHT_SETS_TABLE = 'recommendation_weight_sets';

function recordToRow(record: RecommendationRecord): Record<string, unknown> {
  const normalized = normalizeRecommendationRecord(record);
  return {
    id: normalized.id,
    lead_id: normalized.leadId,
    offer_id: normalized.offerId,
    created_by_user_id: normalized.createdByUserId,
    data: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function rowToRecord(row: JsonTableRow): RecommendationRecord {
  return normalizeRecommendationRecord(
    rowData(row, {
      id: row.id,
      leadId: row.lead_id,
      offerId: row.offer_id,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

function weightSetToRow(weightSet: RecommendationWeightSet): Record<string, unknown> {
  return {
    id: weightSet.id,
    data: weightSet,
    created_at: weightSet.createdAt,
    updated_at: weightSet.updatedAt,
  };
}

export class SupabaseRecommendationRepository implements RecommendationRepository {
  async getRecords(): Promise<RecommendationRecord[]> {
    const rows = await sbSelectAll(RECORDS_TABLE);
    return normalizeRecommendationRecords(rows.map((row) => rowToRecord(row)));
  }

  async saveRecord(record: RecommendationRecord): Promise<void> {
    const normalized = normalizeRecommendationRecord(record);
    const existing = await sbSelectAll(RECORDS_TABLE);
    const found = existing.some((row) => row.id === normalized.id);
    const rowPayload = recordToRow(normalized);
    if (found) {
      await sbUpdate(RECORDS_TABLE, normalized.id, rowPayload);
    } else {
      await sbInsert(RECORDS_TABLE, rowPayload);
    }
  }

  async getWeightSets(): Promise<RecommendationWeightSet[]> {
    const rows = await sbSelectAll(WEIGHT_SETS_TABLE);
    return normalizeRecommendationWeightSets(rows.map((row) => rowData(row, { id: row.id })));
  }

  async saveWeightSets(weightSets: RecommendationWeightSet[]): Promise<void> {
    const normalized = normalizeRecommendationWeightSets(weightSets);
    await sbUpsertMany(WEIGHT_SETS_TABLE, normalized.map(weightSetToRow));
  }
}
