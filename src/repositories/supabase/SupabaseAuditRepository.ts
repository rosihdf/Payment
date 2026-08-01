import { normalizeAuditEntries, normalizeAuditEntry } from '../../domain/audit/normalizeAuditEntry';
import type { AuditEntry } from '../../domain/audit/auditEntry';
import type { AuditRepository } from '../interfaces/AuditRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbUpsertMany,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'audit_entries';

function entryToRow(entry: AuditEntry): Record<string, unknown> {
  return {
    id: entry.id,
    user_id: entry.userId,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    data: entry,
    created_at: entry.timestamp,
  };
}

function rowToEntry(row: JsonTableRow): AuditEntry {
  const normalized = normalizeAuditEntry(
    rowData(row, {
      id: row.id,
      userId: row.user_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      timestamp: row.created_at,
    }),
  );
  if (!normalized) {
    throw new Error(`AuditEntry konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseAuditRepository implements AuditRepository {
  async getAll(): Promise<AuditEntry[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeAuditEntries(rows.map((row) => rowToEntry(row)));
  }

  async append(entry: AuditEntry): Promise<AuditEntry> {
    const row = await sbInsert(TABLE, entryToRow(entry));
    return rowToEntry(row);
  }

  async saveAll(entries: AuditEntry[]): Promise<AuditEntry[]> {
    await sbUpsertMany(TABLE, entries.map(entryToRow));
    return entries;
  }
}
