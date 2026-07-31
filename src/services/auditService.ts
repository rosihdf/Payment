import { AUDIT_ENTRY_SCHEMA_VERSION, type AuditAction, type AuditEntityType, type AuditEntry } from '../domain/audit/auditEntry';
import type { Permission } from '../domain/permission/permission';
import { hasPermission } from '../domain/permission/permission';
import type { UserContext, UserRole } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { AuditRepository } from '../repositories/interfaces/AuditRepository';

export interface AuditFilter {
  query?: string;
  userId?: string;
  entityType?: AuditEntityType | 'all';
  action?: AuditAction | 'all';
  from?: string;
  to?: string;
}

export class AuditService {
  private readonly auditRepository: AuditRepository;

  constructor(auditRepository: AuditRepository) {
    this.auditRepository = auditRepository;
  }

  canViewAudit(context: UserContext): boolean {
    return hasPermission(context.role, 'admin.audit') && context.status === 'active';
  }

  async logChange(input: {
    context: UserContext;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string;
    entityVersion?: string | null;
    summary: string;
    changes?: AuditEntry['changes'];
    source?: AuditEntry['source'];
  }): Promise<AuditEntry | null> {
    const entry: AuditEntry = {
      id: generateId('audit'),
      schemaVersion: AUDIT_ENTRY_SCHEMA_VERSION,
      timestamp: nowIso(),
      userId: input.context.userId,
      userDisplayName: input.context.displayName,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityVersion: input.entityVersion ?? null,
      summary: input.summary,
      changes: input.changes ?? [],
      source: input.source ?? 'admin',
    };

    return this.auditRepository.append(entry);
  }

  filterEntries(entries: AuditEntry[], filter: AuditFilter): AuditEntry[] {
    return entries.filter((entry) => {
      if (filter.userId && entry.userId !== filter.userId) {
        return false;
      }
      if (filter.entityType && filter.entityType !== 'all' && entry.entityType !== filter.entityType) {
        return false;
      }
      if (filter.action && filter.action !== 'all' && entry.action !== filter.action) {
        return false;
      }
      if (filter.from && entry.timestamp < filter.from) {
        return false;
      }
      if (filter.to && entry.timestamp > filter.to) {
        return false;
      }
      if (filter.query) {
        const query = filter.query.toLowerCase();
        const haystack = `${entry.summary} ${entry.entityId} ${entry.userDisplayName}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }

  async getEntries(context: UserContext, filter: AuditFilter = {}): Promise<AuditEntry[] | { error: 'forbidden' }> {
    if (!this.canViewAudit(context)) {
      return { error: 'forbidden' };
    }
    const entries = await this.auditRepository.getAll();
    return this.filterEntries(entries, filter);
  }
}

export function createUserContext(user: {
  id: string;
  role: UserRole;
  name: string;
  status: UserContext['status'];
}): UserContext {
  return {
    userId: user.id,
    role: user.role,
    displayName: user.name,
    status: user.status,
  };
}

export function requirePermission(
  context: UserContext,
  permission: Permission,
): { ok: true } | { ok: false; error: 'forbidden' | 'deactivated' } {
  if (context.status !== 'active') {
    return { ok: false, error: 'deactivated' };
  }
  if (!hasPermission(context.role, permission)) {
    return { ok: false, error: 'forbidden' };
  }
  return { ok: true };
}
