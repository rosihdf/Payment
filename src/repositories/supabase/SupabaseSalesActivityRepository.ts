import type { SalesActivity } from '../../domain/salesWorkspace/salesActivity';
import { normalizeSalesActivity } from '../../services/salesWorkspaceStorageMigration';
import type { SalesActivityRepository } from '../interfaces/SalesActivityRepository';
import {
  rowData,
  sbDelete,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'sales_activities';

function activityToRow(activity: SalesActivity): Record<string, unknown> {
  return {
    id: activity.id,
    created_by_user_id: activity.createdByUserId,
    lead_id: activity.leadId,
    offer_id: activity.offerId,
    contract_id: activity.contractId,
    activation_id: activity.activationId,
    data: activity,
    created_at: activity.createdAt,
  };
}

function rowToActivity(row: JsonTableRow): SalesActivity {
  const normalized = normalizeSalesActivity(
    rowData(row, {
      id: row.id,
      createdByUserId: row.created_by_user_id,
      leadId: row.lead_id,
      offerId: row.offer_id,
      contractId: row.contract_id,
      activationId: row.activation_id,
      createdAt: row.created_at,
    }),
  );
  if (!normalized) {
    throw new Error(`SalesActivity konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseSalesActivityRepository implements SalesActivityRepository {
  async getAll(): Promise<SalesActivity[]> {
    const rows = await sbSelectAll(TABLE);
    return rows
      .map((row) => rowToActivity(row))
      .filter((entry): entry is SalesActivity => entry !== null);
  }

  async getById(id: string): Promise<SalesActivity | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToActivity(row) : null;
  }

  async create(activity: SalesActivity): Promise<SalesActivity> {
    const row = await sbInsert(TABLE, activityToRow(activity));
    return rowToActivity(row);
  }

  async update(activity: SalesActivity): Promise<SalesActivity> {
    const existing = await this.getById(activity.id);
    if (!existing) {
      throw new Error(`SalesActivity not found: ${activity.id}`);
    }
    const row = await sbUpdate(TABLE, activity.id, activityToRow(activity));
    return rowToActivity(row);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }
    await sbDelete(TABLE, id);
    return true;
  }
}
