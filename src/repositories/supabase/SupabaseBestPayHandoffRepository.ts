import { normalizeBestPayHandoffs } from '../../domain/offer/normalizeBestPayHandoff';
import type { BestPayHandoff } from '../../domain/offer/bestPayHandoff';
import type { BestPayHandoffRepository } from '../interfaces/BestPayHandoffRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'bestpay_handoffs';

function handoffToRow(handoff: BestPayHandoff): Record<string, unknown> {
  return {
    id: handoff.id,
    offer_id: handoff.offerId,
    offer_version_id: handoff.offerVersionId,
    acceptance_id: handoff.acceptanceId,
    data: handoff,
    created_at: handoff.createdAt,
    updated_at: handoff.updatedAt,
  };
}

function rowToHandoff(row: JsonTableRow): BestPayHandoff {
  const normalized = normalizeBestPayHandoffs([
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      offerVersionId: row.offer_version_id,
      acceptanceId: row.acceptance_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  ])[0];
  if (!normalized) {
    throw new Error(`BestPayHandoff konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseBestPayHandoffRepository implements BestPayHandoffRepository {
  async getAll(): Promise<BestPayHandoff[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeBestPayHandoffs(rows.map((row) => rowToHandoff(row)));
  }

  async getById(id: string): Promise<BestPayHandoff | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToHandoff(row) : null;
  }

  async getByOfferId(offerId: string): Promise<BestPayHandoff[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizeBestPayHandoffs(rows.map((row) => rowToHandoff(row)));
  }

  async getByOfferVersionId(offerVersionId: string): Promise<BestPayHandoff | null> {
    const handoffs = await this.getAll();
    return handoffs.find((entry) => entry.offerVersionId === offerVersionId) ?? null;
  }

  async create(handoff: BestPayHandoff): Promise<BestPayHandoff> {
    const existing = await this.getById(handoff.id);
    if (existing) {
      throw new Error(`BestPayHandoff already exists: ${handoff.id}`);
    }
    const row = await sbInsert(TABLE, handoffToRow(handoff));
    return rowToHandoff(row);
  }

  async update(handoff: BestPayHandoff): Promise<BestPayHandoff> {
    const existing = await this.getById(handoff.id);
    if (!existing) {
      throw new Error(`BestPayHandoff not found: ${handoff.id}`);
    }
    const row = await sbUpdate(TABLE, handoff.id, handoffToRow(handoff));
    return rowToHandoff(row);
  }
}
