export type UserRole = 'field_service' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  field_service: 'Außendienst',
  admin: 'Admin',
};
