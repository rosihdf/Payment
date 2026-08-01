import {
  normalizeContractTermination,
  normalizeContractTerminations,
} from '../../domain/contract/normalizeContract';
import type { ContractTermination } from '../../domain/contract/contractTermination';
import type { ContractTerminationRepository } from '../interfaces/ContractTerminationRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'contract_terminations';

function terminationToRow(termination: ContractTermination): Record<string, unknown> {
  return {
    id: termination.id,
    contract_id: termination.contractId,
    created_by_user_id: termination.documentedByUserId,
    data: termination,
    created_at: termination.documentedAt,
    updated_at: termination.documentedAt,
  };
}

function rowToTermination(row: JsonTableRow): ContractTermination {
  const normalized = normalizeContractTermination(
    rowData(row, {
      id: row.id,
      contractId: row.contract_id,
      documentedByUserId: row.created_by_user_id,
      documentedAt: row.created_at,
    }),
  );
  if (!normalized) {
    throw new Error(`ContractTermination konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseContractTerminationRepository implements ContractTerminationRepository {
  async getAll(): Promise<ContractTermination[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeContractTerminations(rows.map((row) => rowToTermination(row)));
  }

  async getById(id: string): Promise<ContractTermination | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToTermination(row) : null;
  }

  async getByContractId(contractId: string): Promise<ContractTermination[]> {
    const rows = await sbSelectWhere(TABLE, 'contract_id', contractId);
    return normalizeContractTerminations(rows.map((row) => rowToTermination(row))).sort((a, b) =>
      b.documentedAt.localeCompare(a.documentedAt),
    );
  }

  async create(termination: ContractTermination): Promise<ContractTermination> {
    const existing = await this.getById(termination.id);
    if (existing) {
      throw new Error(`ContractTermination already exists: ${termination.id}`);
    }
    const row = await sbInsert(TABLE, terminationToRow(termination));
    return rowToTermination(row);
  }

  async update(termination: ContractTermination): Promise<ContractTermination> {
    const existing = await this.getById(termination.id);
    if (!existing) {
      throw new Error(`ContractTermination not found: ${termination.id}`);
    }
    const row = await sbUpdate(TABLE, termination.id, terminationToRow(termination));
    return rowToTermination(row);
  }
}
