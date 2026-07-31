import { normalizeAuditEntries } from '../../domain/audit/normalizeAuditEntry';
import type { AuditEntry } from '../../domain/audit/auditEntry';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { AuditRepository } from '../interfaces/AuditRepository';

export class LocalAuditRepository implements AuditRepository {
  async getAll(): Promise<AuditEntry[]> {
    return normalizeAuditEntries(readStorageItem<unknown[]>(STORAGE_KEYS.auditEntries));
  }

  async append(entry: AuditEntry): Promise<AuditEntry> {
    const entries = await this.getAll();
    entries.unshift(entry);
    writeStorageItem(STORAGE_KEYS.auditEntries, entries);
    return entry;
  }

  async saveAll(entries: AuditEntry[]): Promise<AuditEntry[]> {
    writeStorageItem(STORAGE_KEYS.auditEntries, entries);
    return entries;
  }
}
