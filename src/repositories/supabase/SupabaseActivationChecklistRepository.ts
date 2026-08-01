import type { ActivationChecklistItem } from '../../domain/activation/activationChecklist';
import { normalizeActivationChecklistItems } from '../../domain/activation/normalizeActivation';
import type { ActivationChecklistRepository } from '../interfaces/ActivationChecklistRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'activation_checklists';

function itemToRow(item: ActivationChecklistItem): Record<string, unknown> {
  return {
    id: item.id,
    activation_id: item.activationId,
    data: item,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function rowToItem(row: JsonTableRow): ActivationChecklistItem {
  const normalized = normalizeActivationChecklistItems([rowData(row, { id: row.id })])[0];
  if (!normalized) {
    throw new Error(`ActivationChecklistItem konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseActivationChecklistRepository implements ActivationChecklistRepository {
  async getAll(): Promise<ActivationChecklistItem[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeActivationChecklistItems(rows.map((row) => rowToItem(row)));
  }

  async getByActivationId(activationId: string): Promise<ActivationChecklistItem[]> {
    const rows = await sbSelectWhere(TABLE, 'activation_id', activationId);
    return normalizeActivationChecklistItems(rows.map((row) => rowToItem(row))).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
  }

  async getById(id: string): Promise<ActivationChecklistItem | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToItem(row) : null;
  }

  async create(item: ActivationChecklistItem): Promise<ActivationChecklistItem> {
    const existing = await this.getById(item.id);
    if (existing) {
      throw new Error(`ActivationChecklistItem already exists: ${item.id}`);
    }
    const row = await sbInsert(TABLE, itemToRow(item));
    return rowToItem(row);
  }

  async createMany(items: ActivationChecklistItem[]): Promise<ActivationChecklistItem[]> {
    const created: ActivationChecklistItem[] = [];
    for (const item of items) {
      created.push(await this.create(item));
    }
    return created;
  }

  async update(item: ActivationChecklistItem): Promise<ActivationChecklistItem> {
    const existing = await this.getById(item.id);
    if (!existing) {
      throw new Error(`ActivationChecklistItem not found: ${item.id}`);
    }
    const row = await sbUpdate(TABLE, item.id, itemToRow(item));
    return rowToItem(row);
  }
}
