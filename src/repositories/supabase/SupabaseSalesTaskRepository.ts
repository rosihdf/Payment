import type { SalesTask } from '../../domain/salesWorkspace/salesTask';
import { normalizeSalesTask } from '../../services/salesWorkspaceStorageMigration';
import type { SalesTaskRepository } from '../interfaces/SalesTaskRepository';
import {
  rowData,
  sbDelete,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'sales_tasks';

function taskToRow(task: SalesTask): Record<string, unknown> {
  return {
    id: task.id,
    assignee_user_id: task.assigneeUserId,
    created_by_user_id: task.createdByUserId,
    lead_id: task.leadId,
    offer_id: task.offerId,
    contract_id: task.contractId,
    activation_id: task.activationId,
    source_key: task.sourceKey ?? task.id,
    data: task,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

function rowToTask(row: JsonTableRow): SalesTask {
  const normalized = normalizeSalesTask(
    rowData(row, {
      id: row.id,
      assigneeUserId: row.assignee_user_id,
      createdByUserId: row.created_by_user_id,
      leadId: row.lead_id,
      offerId: row.offer_id,
      contractId: row.contract_id,
      activationId: row.activation_id,
      sourceKey: row.source_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
  if (!normalized) {
    throw new Error(`SalesTask konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseSalesTaskRepository implements SalesTaskRepository {
  async getAll(): Promise<SalesTask[]> {
    const rows = await sbSelectAll(TABLE);
    return rows
      .map((row) => rowToTask(row))
      .filter((entry): entry is SalesTask => entry !== null);
  }

  async getById(id: string): Promise<SalesTask | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToTask(row) : null;
  }

  async create(task: SalesTask): Promise<SalesTask> {
    const row = await sbInsert(TABLE, taskToRow(task));
    return rowToTask(row);
  }

  async update(task: SalesTask): Promise<SalesTask> {
    const existing = await this.getById(task.id);
    if (!existing) {
      throw new Error(`SalesTask not found: ${task.id}`);
    }
    const row = await sbUpdate(TABLE, task.id, taskToRow(task));
    return rowToTask(row);
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
