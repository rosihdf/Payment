import type { ActivationCase } from '../../domain/activation/activationCase';
import { normalizeActivationCases } from '../../domain/activation/normalizeActivation';
import type { ActivationCaseRepository } from '../interfaces/ActivationCaseRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'activation_cases';

function caseToRow(activationCase: ActivationCase): Record<string, unknown> {
  return {
    id: activationCase.id,
    contract_id: activationCase.contractId,
    lead_id: activationCase.leadId ?? '',
    source_offer_id: activationCase.sourceOfferId,
    owner_user_id: activationCase.ownerUserId,
    created_by_user_id: activationCase.createdByUserId,
    source_key: activationCase.sourceKey,
    data: activationCase,
    created_at: activationCase.createdAt,
    updated_at: activationCase.updatedAt,
  };
}

function rowToCase(row: JsonTableRow): ActivationCase {
  const normalized = normalizeActivationCases([rowData(row, { id: row.id })])[0];
  if (!normalized) {
    throw new Error(`ActivationCase konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseActivationCaseRepository implements ActivationCaseRepository {
  async getAll(): Promise<ActivationCase[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeActivationCases(rows.map((row) => rowToCase(row)));
  }

  async getById(id: string): Promise<ActivationCase | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToCase(row) : null;
  }

  async getBySourceKey(sourceKey: string): Promise<ActivationCase | null> {
    const cases = await this.getAll();
    return cases.find((entry) => entry.sourceKey === sourceKey) ?? null;
  }

  async getByContractId(contractId: string): Promise<ActivationCase | null> {
    const cases = await this.getAll();
    return cases.find((entry) => entry.contractId === contractId) ?? null;
  }

  async create(activationCase: ActivationCase): Promise<ActivationCase> {
    const existing = await this.getById(activationCase.id);
    if (existing) {
      throw new Error(`ActivationCase already exists: ${activationCase.id}`);
    }
    const row = await sbInsert(TABLE, caseToRow(activationCase));
    return rowToCase(row);
  }

  async update(activationCase: ActivationCase): Promise<ActivationCase> {
    const existing = await this.getById(activationCase.id);
    if (!existing) {
      throw new Error(`ActivationCase not found: ${activationCase.id}`);
    }
    const row = await sbUpdate(TABLE, activationCase.id, caseToRow(activationCase));
    return rowToCase(row);
  }
}
