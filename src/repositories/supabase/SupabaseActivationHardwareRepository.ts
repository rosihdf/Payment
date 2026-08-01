import type { ActivationHardwareAssignment } from '../../domain/activation/activationHardware';
import { normalizeActivationHardwareList } from '../../domain/activation/normalizeActivation';
import type { ActivationHardwareRepository } from '../interfaces/ActivationHardwareRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'activation_hardware';

async function assignmentToRow(
  assignment: ActivationHardwareAssignment,
): Promise<Record<string, unknown>> {
  const activationRow = await sbSelectById('activation_cases', assignment.activationId);
  const createdByUserId = (activationRow?.created_by_user_id as string | undefined) ?? '';
  return {
    id: assignment.id,
    activation_id: assignment.activationId,
    created_by_user_id: createdByUserId,
    data: assignment,
    created_at: assignment.createdAt,
    updated_at: assignment.updatedAt,
  };
}

function rowToAssignment(row: JsonTableRow): ActivationHardwareAssignment {
  const normalized = normalizeActivationHardwareList([rowData(row, { id: row.id })])[0];
  if (!normalized) {
    throw new Error(`ActivationHardwareAssignment konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseActivationHardwareRepository implements ActivationHardwareRepository {
  async getAll(): Promise<ActivationHardwareAssignment[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeActivationHardwareList(rows.map((row) => rowToAssignment(row)));
  }

  async getByActivationId(activationId: string): Promise<ActivationHardwareAssignment[]> {
    const rows = await sbSelectWhere(TABLE, 'activation_id', activationId);
    return normalizeActivationHardwareList(rows.map((row) => rowToAssignment(row)));
  }

  async getById(id: string): Promise<ActivationHardwareAssignment | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToAssignment(row) : null;
  }

  async create(assignment: ActivationHardwareAssignment): Promise<ActivationHardwareAssignment> {
    const existing = await this.getById(assignment.id);
    if (existing) {
      throw new Error(`ActivationHardwareAssignment already exists: ${assignment.id}`);
    }
    const row = await sbInsert(TABLE, await assignmentToRow(assignment));
    return rowToAssignment(row);
  }

  async createMany(
    assignments: ActivationHardwareAssignment[],
  ): Promise<ActivationHardwareAssignment[]> {
    const created: ActivationHardwareAssignment[] = [];
    for (const assignment of assignments) {
      created.push(await this.create(assignment));
    }
    return created;
  }

  async update(assignment: ActivationHardwareAssignment): Promise<ActivationHardwareAssignment> {
    const existing = await this.getById(assignment.id);
    if (!existing) {
      throw new Error(`ActivationHardwareAssignment not found: ${assignment.id}`);
    }
    const row = await sbUpdate(TABLE, assignment.id, await assignmentToRow(assignment));
    return rowToAssignment(row);
  }
}
