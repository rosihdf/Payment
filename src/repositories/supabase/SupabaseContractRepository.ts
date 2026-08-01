import { normalizeContracts } from '../../domain/contract/normalizeContract';
import type { Contract } from '../../domain/contract/contract';
import type { ContractRepository } from '../interfaces/ContractRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'contracts';

function contractToRow(contract: Contract): Record<string, unknown> {
  return {
    id: contract.id,
    lead_id: contract.leadId ?? '',
    source_offer_id: contract.sourceOfferId,
    owner_user_id: contract.ownerUserId,
    created_by_user_id: contract.createdByUserId,
    source_key: contract.sourceKey,
    data: contract,
    created_at: contract.createdAt,
    updated_at: contract.updatedAt,
  };
}

function rowToContract(row: JsonTableRow): Contract {
  const normalized = normalizeContracts([
    rowData(row, {
      id: row.id,
      leadId: row.lead_id,
      sourceOfferId: row.source_offer_id,
      ownerUserId: row.owner_user_id,
      createdByUserId: row.created_by_user_id,
      sourceKey: row.source_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  ])[0];
  if (!normalized) {
    throw new Error(`Contract konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseContractRepository implements ContractRepository {
  async getAll(): Promise<Contract[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeContracts(rows.map((row) => rowToContract(row)));
  }

  async getById(id: string): Promise<Contract | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToContract(row) : null;
  }

  async getBySourceKey(sourceKey: string): Promise<Contract | null> {
    const contracts = await this.getAll();
    return contracts.find((entry) => entry.sourceKey === sourceKey) ?? null;
  }

  async getByOfferId(offerId: string): Promise<Contract | null> {
    const contracts = await this.getAll();
    return contracts.find((entry) => entry.sourceOfferId === offerId) ?? null;
  }

  async create(contract: Contract): Promise<Contract> {
    const existing = await this.getById(contract.id);
    if (existing) {
      throw new Error(`Contract already exists: ${contract.id}`);
    }
    const row = await sbInsert(TABLE, contractToRow(contract));
    return rowToContract(row);
  }

  async update(contract: Contract): Promise<Contract> {
    const existing = await this.getById(contract.id);
    if (!existing) {
      throw new Error(`Contract not found: ${contract.id}`);
    }
    const row = await sbUpdate(TABLE, contract.id, contractToRow(contract));
    return rowToContract(row);
  }
}
