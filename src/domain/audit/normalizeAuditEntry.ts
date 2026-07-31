import type { AuditEntry } from './auditEntry';
import { AUDIT_ENTRY_SCHEMA_VERSION } from './auditEntry';

export function normalizeAuditEntry(raw: unknown): AuditEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const id = typeof entry.id === 'string' ? entry.id : '';
  const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : '';
  const userId = typeof entry.userId === 'string' ? entry.userId : '';
  const action = typeof entry.action === 'string' ? entry.action : '';
  const entityType = typeof entry.entityType === 'string' ? entry.entityType : '';
  const entityId = typeof entry.entityId === 'string' ? entry.entityId : '';
  const summary = typeof entry.summary === 'string' ? entry.summary : '';

  if (!id || !timestamp || !userId || !action || !entityType || !entityId) {
    return null;
  }

  const changes = Array.isArray(entry.changes)
    ? entry.changes
        .map((change) => {
          if (!change || typeof change !== 'object') {
            return null;
          }
          const row = change as Record<string, unknown>;
          const field = typeof row.field === 'string' ? row.field : '';
          if (!field) {
            return null;
          }
          return {
            field,
            before: typeof row.before === 'string' ? row.before : row.before === null ? null : String(row.before ?? ''),
            after: typeof row.after === 'string' ? row.after : row.after === null ? null : String(row.after ?? ''),
          };
        })
        .filter((change): change is AuditEntry['changes'][number] => change !== null)
    : [];

  return {
    id,
    schemaVersion:
      typeof entry.schemaVersion === 'number' ? entry.schemaVersion : AUDIT_ENTRY_SCHEMA_VERSION,
    timestamp,
    userId,
    userDisplayName: typeof entry.userDisplayName === 'string' ? entry.userDisplayName : 'System',
    action: action as AuditEntry['action'],
    entityType: entityType as AuditEntry['entityType'],
    entityId,
    entityVersion: typeof entry.entityVersion === 'string' ? entry.entityVersion : null,
    summary,
    changes,
    source:
      entry.source === 'admin' || entry.source === 'system' || entry.source === 'migration'
        ? entry.source
        : 'system',
  };
}

export function normalizeAuditEntries(raw: unknown): AuditEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => normalizeAuditEntry(entry))
    .filter((entry): entry is AuditEntry => entry !== null);
}
