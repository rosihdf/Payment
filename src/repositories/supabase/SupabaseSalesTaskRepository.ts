import type { SalesTask } from '../../domain/salesWorkspace/salesTask';
import { normalizeSalesTask } from '../../services/salesWorkspaceStorageMigration';
import type { SalesTaskRepository } from '../interfaces/SalesTaskRepository';
import {
  rowData,
  sbDelete,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
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

function isDuplicateSourceKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('duplicate key') || error.message.includes('sales_tasks_source_key_uidx'))
  );
}

function rowToTask(row: JsonTableRow): SalesTask | null {
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
    console.warn(`SalesTask konnte nicht normalisiert werden: ${row.id}`);
    return null;
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

  async getBySourceKey(sourceKey: string): Promise<SalesTask | null> {
    const rows = await sbSelectWhere(TABLE, 'source_key', sourceKey);
    const task = rows.map((row) => rowToTask(row)).find((entry): entry is SalesTask => entry !== null);
    return task ?? null;
  }

  async create(task: SalesTask): Promise<SalesTask> {
    if (task.sourceKey) {
      const existing = await this.getBySourceKey(task.sourceKey);
      if (existing) {
        return existing;
      }
    }

    try {
      const row = await sbInsert(TABLE, taskToRow(task));
      const normalized = rowToTask(row);
      if (!normalized) {
        throw new Error(`SalesTask konnte nach Anlage nicht normalisiert werden: ${task.id}`);
      }
      return normalized;
    } catch (error) {
      if (task.sourceKey && isDuplicateSourceKeyError(error)) {
        const existing = await this.getBySourceKey(task.sourceKey);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async update(task: SalesTask): Promise<SalesTask> {
    const existing = await this.getById(task.id);
    if (!existing) {
      throw new Error(`SalesTask not found: ${task.id}`);
    }
    const row = await sbUpdate(TABLE, task.id, taskToRow(task));
    const normalized = rowToTask(row);
    if (!normalized) {
      throw new Error(`SalesTask konnte nach Update nicht normalisiert werden: ${task.id}`);
    }
    return normalized;
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
