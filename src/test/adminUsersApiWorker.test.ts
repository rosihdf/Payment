import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

import {
  handleInviteUser,
  handleUpdateUser,
  handleDeactivateUser,
  routeAdminUsersApi,
  type AdminEnv,
  type ProfileRow,
} from '../../workers/amrtech-payment/src/adminUsersApi';

function adminProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    user_id: 'admin-1',
    display_name: 'Michael Rosenau',
    email: 'm.rosenau@amrtech.de',
    role: 'admin',
    status: 'active',
    sales_team_id: null,
    schema_version: 3,
    deactivated_at: null,
    last_access_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function env(): AdminEnv {
  return {
    SUPABASE_URL: 'https://vohnqrftkuefkugabcob.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-test-key',
  };
}

function buildClient(options: {
  caller?: ProfileRow | null;
  authError?: boolean;
  existingEmail?: boolean;
  inviteUserId?: string;
  inviteError?: string | null;
  insertError?: string | null;
  targetProfile?: ProfileRow | null;
  allProfiles?: ProfileRow[];
}) {
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  const inviteUserByEmail = vi.fn().mockResolvedValue({
    data: options.inviteError ? { user: null } : { user: { id: options.inviteUserId ?? 'new-1' } },
    error: options.inviteError ? { message: options.inviteError } : null,
  });
  const updateUserById = vi.fn().mockResolvedValue({ error: null });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.authError || !options.caller ? null : { id: options.caller.user_id },
        },
        error: options.authError || !options.caller ? { message: 'invalid' } : null,
      }),
      admin: { inviteUserByEmail, deleteUser, updateUserById },
    },
    from: vi.fn(() => {
      const ctx = {
        op: 'select' as string,
        filters: {} as Record<string, string>,
        columns: '',
      };
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn((columns?: string) => {
        ctx.columns = columns ?? '';
        return builder;
      });
      builder.insert = vi.fn((row: ProfileRow) => {
        ctx.op = 'insert';
        (builder as { _row?: ProfileRow })._row = row;
        return builder;
      });
      builder.update = vi.fn((row: Partial<ProfileRow>) => {
        ctx.op = 'update';
        (builder as { _row?: Partial<ProfileRow> })._row = row;
        return builder;
      });
      builder.eq = vi.fn((key: string, value: string) => {
        ctx.filters[key] = value;
        return builder;
      });
      builder.maybeSingle = vi.fn(async () => {
        if (ctx.filters.email) {
          return {
            data: options.existingEmail ? { user_id: 'dup' } : null,
            error: null,
          };
        }
        if (ctx.filters.user_id) {
          if (options.targetProfile && ctx.filters.user_id === options.targetProfile.user_id) {
            return { data: options.targetProfile, error: null };
          }
          if (options.caller && ctx.filters.user_id === options.caller.user_id) {
            return { data: options.caller, error: null };
          }
          return { data: null, error: null };
        }
        return { data: options.caller, error: null };
      });
      builder.single = vi.fn(async () => {
        if (options.insertError) {
          return { data: null, error: { message: options.insertError } };
        }
        if (ctx.op === 'insert') {
          return {
            data: (builder as { _row?: ProfileRow })._row,
            error: null,
          };
        }
        if (ctx.op === 'update') {
          return {
            data: {
              ...(options.targetProfile ?? options.caller),
              ...(builder as { _row?: Partial<ProfileRow> })._row,
            },
            error: null,
          };
        }
        return { data: options.caller, error: null };
      });
      // Awaitable select for countActiveAdmins
      (builder as { then?: unknown }).then = (
        resolve: (value: { data: ProfileRow[]; error: null }) => void,
      ) => {
        const profiles =
          options.allProfiles ??
          [options.caller, options.targetProfile].filter(Boolean) as ProfileRow[];
        resolve({ data: profiles, error: null });
      };
      return builder;
    }),
  };

  return { client, deleteUser, inviteUserByEmail, updateUserById };
}

describe('admin users worker API', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 without JWT', async () => {
    const response = await handleInviteUser(
      new Request('https://example.com/api/admin/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'a@example.com',
          displayName: 'A',
          role: 'field_service',
        }),
      }),
      env(),
    );
    expect(response.status).toBe(401);
  });

  it('returns 403 for field_service JWT', async () => {
    const { client } = buildClient({
      caller: adminProfile({ user_id: 'fs-1', role: 'field_service', email: 'fs@example.com' }),
    });
    createClientMock.mockReturnValue(client);

    const response = await handleInviteUser(
      new Request('https://example.com/api/admin/users/invite', {
        method: 'POST',
        headers: { Authorization: 'Bearer fs-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'a@example.com',
          displayName: 'A',
          role: 'field_service',
        }),
      }),
      env(),
    );
    expect(response.status).toBe(403);
  });

  it('invites field_service user for admin JWT', async () => {
    const { client, inviteUserByEmail } = buildClient({
      caller: adminProfile(),
      inviteUserId: 'new-user-1',
    });
    createClientMock.mockReturnValue(client);

    const response = await handleInviteUser(
      new Request('https://example.com/api/admin/users/invite', {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'field.new@example.com',
          displayName: 'Neuer Außendienst',
          role: 'field_service',
        }),
      }),
      env(),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; user: ProfileRow; auditAction: string };
    expect(body.ok).toBe(true);
    expect(body.user.status).toBe('invited');
    expect(body.user.role).toBe('field_service');
    expect(body.auditAction).toBe('user_invited');
    expect(inviteUserByEmail).toHaveBeenCalled();
  });

  it('blocks duplicate email', async () => {
    const { client } = buildClient({
      caller: adminProfile(),
      existingEmail: true,
    });
    createClientMock.mockReturnValue(client);

    const response = await handleInviteUser(
      new Request('https://example.com/api/admin/users/invite', {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'dup@example.com',
          displayName: 'Dup',
          role: 'admin',
        }),
      }),
      env(),
    );
    expect(response.status).toBe(409);
  });

  it('rolls back auth user when profile insert fails', async () => {
    const { client, deleteUser } = buildClient({
      caller: adminProfile(),
      inviteUserId: 'rollback-user',
      insertError: 'insert failed',
    });
    createClientMock.mockReturnValue(client);

    const response = await handleInviteUser(
      new Request('https://example.com/api/admin/users/invite', {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'rollback@example.com',
          displayName: 'Rollback',
          role: 'field_service',
        }),
      }),
      env(),
    );

    expect(response.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith('rollback-user');
  });

  it('protects last active admin from demotion', async () => {
    const target = adminProfile({ user_id: 'only-admin', role: 'admin', status: 'active' });
    const { client } = buildClient({
      caller: target,
      targetProfile: target,
      allProfiles: [target],
    });
    createClientMock.mockReturnValue(client);

    const response = await handleUpdateUser(
      new Request('https://example.com/api/admin/users/only-admin', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'field_service' }),
      }),
      env(),
      'only-admin',
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('protected');
  });

  it('deactivates and bans user', async () => {
    const target = adminProfile({
      user_id: 'fs-2',
      role: 'field_service',
      email: 'fs2@example.com',
      status: 'active',
    });
    const { client, updateUserById } = buildClient({
      caller: adminProfile(),
      targetProfile: target,
      allProfiles: [adminProfile(), target],
    });
    createClientMock.mockReturnValue(client);

    const response = await handleDeactivateUser(
      new Request('https://example.com/api/admin/users/fs-2/deactivate', {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env(),
      'fs-2',
    );
    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalled();
  });

  it('returns 404 for unknown api route', async () => {
    const response = await routeAdminUsersApi(
      new Request('https://example.com/api/nope', { method: 'GET' }),
      env(),
    );
    expect(response?.status).toBe(404);
  });

  it('rejects unknown roles', async () => {
    const { client } = buildClient({ caller: adminProfile() });
    createClientMock.mockReturnValue(client);

    const response = await handleInviteUser(
      new Request('https://example.com/api/admin/users/invite', {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'x@example.com',
          displayName: 'X',
          role: 'superadmin',
        }),
      }),
      env(),
    );
    expect(response.status).toBe(400);
  });
});
