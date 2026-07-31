import type { User, UserRole, UserStatus } from './user';
import { isAssignableUserRole } from './user';

export const CURRENT_USER_SCHEMA_VERSION = 3;

/**
 * Historische Rollenschlüssel → aktuelle Rollen.
 * Altrollen bleiben lesbar und werden konservativ zugeordnet.
 */
const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  admin: 'admin',
  field_service: 'field_service',
  sales_lead: 'admin',
  sales_manager: 'admin',
  reviewer: 'admin',
  approver: 'admin',
  readonly: 'field_service',
  read_only: 'field_service',
};

const VALID_STATUSES: UserStatus[] = ['active', 'deactivated', 'invited'];

export function mapLegacyUserRole(value: unknown): UserRole {
  if (typeof value !== 'string') {
    return 'field_service';
  }
  return LEGACY_ROLE_MAP[value] ?? (isAssignableUserRole(value) ? value : 'field_service');
}

function normalizeStatus(value: unknown): UserStatus {
  if (typeof value === 'string' && VALID_STATUSES.includes(value as UserStatus)) {
    return value as UserStatus;
  }
  return 'active';
}

export function normalizeUser(raw: unknown, fallbackTimestamp = '2026-01-01T00:00:00.000Z'): User | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';

  if (!id || !name) {
    return null;
  }

  const email =
    typeof entry.email === 'string' && entry.email.trim()
      ? entry.email.trim()
      : `${id}@demo.local`;

  return {
    id,
    name,
    email,
    role: mapLegacyUserRole(entry.role),
    status: normalizeStatus(entry.status),
    salesTeamId: typeof entry.salesTeamId === 'string' ? entry.salesTeamId : null,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : fallbackTimestamp,
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : fallbackTimestamp,
    deactivatedAt: typeof entry.deactivatedAt === 'string' ? entry.deactivatedAt : null,
    lastAccessAt: typeof entry.lastAccessAt === 'string' ? entry.lastAccessAt : null,
    schemaVersion:
      typeof entry.schemaVersion === 'number' ? entry.schemaVersion : CURRENT_USER_SCHEMA_VERSION,
  };
}

export function normalizeUsers(raw: unknown): User[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeUser(entry))
    .filter((entry): entry is User => entry !== null);
}

export function rawUsersContainLegacyRoles(raw: unknown): boolean {
  if (!Array.isArray(raw)) {
    return false;
  }
  return raw.some((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    const role = (entry as Record<string, unknown>).role;
    return typeof role === 'string' && !isAssignableUserRole(role);
  });
}
