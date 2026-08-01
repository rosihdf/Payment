import {
  normalizeContractVersion,
  normalizeContractVersions,
} from '../../domain/contract/normalizeContract';
import type { ContractVersion } from '../../domain/contract/contractVersion';
import type { ContractVersionRepository } from '../interfaces/ContractVersionRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'contract_versions';

async function versionToRow(version: ContractVersion): Promise<Record<string, unknown>> {
  const contractRow = await sbSelectById('contracts', version.contractId);
  const leadId = (contractRow?.lead_id as string | undefined) ?? '';
  return {
    id: version.id,
    contract_id: version.contractId,
    lead_id: leadId,
    created_by_user_id: version.createdByUserId,
    data: version,
    created_at: version.createdAt,
    updated_at: version.createdAt,
  };
}

function rowToVersion(row: JsonTableRow): ContractVersion {
  const normalized = normalizeContractVersion(
    rowData(row, {
      id: row.id,
      contractId: row.contract_id,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    }),
  );
  if (!normalized) {
    throw new Error(`ContractVersion konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseContractVersionRepository implements ContractVersionRepository {
  async getAll(): Promise<ContractVersion[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeContractVersions(rows.map((row) => rowToVersion(row)));
  }

  async getById(id: string): Promise<ContractVersion | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToVersion(row) : null;
  }

  async getByContractId(contractId: string): Promise<ContractVersion[]> {
    const rows = await sbSelectWhere(TABLE, 'contract_id', contractId);
    return normalizeContractVersions(rows.map((row) => rowToVersion(row))).sort(
      (a, b) => a.versionNumber - b.versionNumber,
    );
  }

  async create(version: ContractVersion): Promise<ContractVersion> {
    const existing = await this.getById(version.id);
    if (existing) {
      throw new Error(`ContractVersion already exists: ${version.id}`);
    }
    const row = await sbInsert(TABLE, await versionToRow(version));
    return rowToVersion(row);
  }

  async update(version: ContractVersion): Promise<ContractVersion> {
    const existing = await this.getById(version.id);
    if (!existing) {
      throw new Error(`ContractVersion not found: ${version.id}`);
    }
    const row = await sbUpdate(TABLE, version.id, await versionToRow(version));
    return rowToVersion(row);
  }
}
