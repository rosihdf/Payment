import type { ActivationApplication } from '../../domain/activation/activationApplication';
import { normalizeActivationApplications } from '../../domain/activation/normalizeActivation';
import type { ActivationApplicationRepository } from '../interfaces/ActivationApplicationRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'activation_applications';

function applicationToRow(application: ActivationApplication): Record<string, unknown> {
  return {
    id: application.id,
    activation_id: application.activationId,
    created_by_user_id: application.createdByUserId,
    data: application,
    created_at: application.createdAt,
    updated_at: application.updatedAt,
  };
}

function rowToApplication(row: JsonTableRow): ActivationApplication {
  const normalized = normalizeActivationApplications([rowData(row, { id: row.id })])[0];
  if (!normalized) {
    throw new Error(`ActivationApplication konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseActivationApplicationRepository implements ActivationApplicationRepository {
  async getAll(): Promise<ActivationApplication[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeActivationApplications(rows.map((row) => rowToApplication(row)));
  }

  async getByActivationId(activationId: string): Promise<ActivationApplication[]> {
    const rows = await sbSelectWhere(TABLE, 'activation_id', activationId);
    return normalizeActivationApplications(rows.map((row) => rowToApplication(row)));
  }

  async getById(id: string): Promise<ActivationApplication | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToApplication(row) : null;
  }

  async create(application: ActivationApplication): Promise<ActivationApplication> {
    const existing = await this.getById(application.id);
    if (existing) {
      throw new Error(`ActivationApplication already exists: ${application.id}`);
    }
    const row = await sbInsert(TABLE, applicationToRow(application));
    return rowToApplication(row);
  }

  async update(application: ActivationApplication): Promise<ActivationApplication> {
    const existing = await this.getById(application.id);
    if (!existing) {
      throw new Error(`ActivationApplication not found: ${application.id}`);
    }
    const row = await sbUpdate(TABLE, application.id, applicationToRow(application));
    return rowToApplication(row);
  }
}
