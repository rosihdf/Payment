export type UserRole =
  | 'field_service'
  | 'sales_lead'
  | 'reviewer'
  | 'readonly'
  | 'admin';

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

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  field_service: 'Außendienst',
  sales_lead: 'Vertriebsleitung',
  reviewer: 'Prüfer',
  readonly: 'Nur Lesen',
  admin: 'Administrator',
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
