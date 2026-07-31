import type { AuditEntry } from '../../domain/audit/auditEntry';

export interface AuditRepository {
  getAll(): Promise<AuditEntry[]>;
  append(entry: AuditEntry): Promise<AuditEntry>;
  saveAll(entries: AuditEntry[]): Promise<AuditEntry[]>;
}
