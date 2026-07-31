import type { User, UserRole, UserStatus } from './user';

export const CURRENT_USER_SCHEMA_VERSION = 2;

const VALID_ROLES: UserRole[] = ['field_service', 'sales_lead', 'reviewer', 'readonly', 'admin'];
const VALID_STATUSES: UserStatus[] = ['active', 'deactivated', 'invited'];

function normalizeRole(value: unknown): UserRole {
  if (typeof value === 'string' && VALID_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }
  return 'field_service';
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
    role: normalizeRole(entry.role),
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
