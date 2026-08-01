import { normalizeUser } from '../../domain/user/normalizeUser';
import type { User } from '../../domain/user/user';

export interface ProfileRow {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  sales_team_id: string | null;
  schema_version: number;
  deactivated_at: string | null;
  last_access_at: string | null;
  created_at: string;
  updated_at: string;
}

export function profileRowToUser(row: ProfileRow): User {
  const user = normalizeUser({
    id: row.user_id,
    name: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    salesTeamId: row.sales_team_id,
    schemaVersion: row.schema_version,
    deactivatedAt: row.deactivated_at,
    lastAccessAt: row.last_access_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  if (!user) {
    throw new Error(`Ungültiges Profil für user_id=${row.user_id}`);
  }

  return user;
}

export function userToProfileRow(user: User): ProfileRow {
  return {
    user_id: user.id,
    display_name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    sales_team_id: user.salesTeamId,
    schema_version: user.schemaVersion,
    deactivated_at: user.deactivatedAt,
    last_access_at: user.lastAccessAt,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}
