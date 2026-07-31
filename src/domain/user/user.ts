export type UserRole = 'admin' | 'field_service';

export type UserStatus = 'active' | 'deactivated' | 'invited';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  salesTeamId: string | null;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
  lastAccessAt: string | null;
  schemaVersion: number;
}

/** Sichtbare und auswählbare Rollen (keine Altrollen). */
export const ASSIGNABLE_USER_ROLES: UserRole[] = ['admin', 'field_service'];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  field_service: 'Außendienst',
};

export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:
    'Verwaltet Benutzer, Tarife, Produkte, Regeln und Systemeinstellungen. Kann alle Kundenfälle einsehen und notwendige Freigaben durchführen.',
  field_service:
    'Bearbeitet eigene Kunden, Beratungen, Angebote und Nachfassaktionen. Hat keinen Zugriff auf Verwaltung und interne Provisionsregeln.',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Aktiv',
  deactivated: 'Deaktiviert',
  invited: 'Eingeladen',
};

export interface UserContext {
  userId: string;
  role: UserRole;
  displayName: string;
  status: UserStatus;
}

export function isAssignableUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'field_service';
}
