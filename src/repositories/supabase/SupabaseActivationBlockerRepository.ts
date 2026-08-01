import type { ActivationBlocker } from '../../domain/activation/activationBlocker';
import { normalizeActivationBlockers } from '../../domain/activation/normalizeActivation';
import type { ActivationBlockerRepository } from '../interfaces/ActivationBlockerRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'activation_blockers';

function blockerToRow(blocker: ActivationBlocker): Record<string, unknown> {
  return {
    id: blocker.id,
    activation_id: blocker.activationId,
    created_by_user_id: blocker.createdByUserId,
    data: blocker,
    created_at: blocker.createdAt,
    updated_at: blocker.createdAt,
  };
}

function rowToBlocker(row: JsonTableRow): ActivationBlocker {
  const normalized = normalizeActivationBlockers([rowData(row, { id: row.id })])[0];
  if (!normalized) {
    throw new Error(`ActivationBlocker konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseActivationBlockerRepository implements ActivationBlockerRepository {
  async getAll(): Promise<ActivationBlocker[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeActivationBlockers(rows.map((row) => rowToBlocker(row)));
  }

  async getByActivationId(activationId: string): Promise<ActivationBlocker[]> {
    const rows = await sbSelectWhere(TABLE, 'activation_id', activationId);
    return normalizeActivationBlockers(rows.map((row) => rowToBlocker(row)));
  }

  async getById(id: string): Promise<ActivationBlocker | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToBlocker(row) : null;
  }

  async create(blocker: ActivationBlocker): Promise<ActivationBlocker> {
    const existing = await this.getById(blocker.id);
    if (existing) {
      throw new Error(`ActivationBlocker already exists: ${blocker.id}`);
    }
    const row = await sbInsert(TABLE, blockerToRow(blocker));
    return rowToBlocker(row);
  }

  async update(blocker: ActivationBlocker): Promise<ActivationBlocker> {
    const existing = await this.getById(blocker.id);
    if (!existing) {
      throw new Error(`ActivationBlocker not found: ${blocker.id}`);
    }
    const row = await sbUpdate(TABLE, blocker.id, blockerToRow(blocker));
    return rowToBlocker(row);
  }
}
