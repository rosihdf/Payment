import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();
const getUserMock = vi.fn();
const updateUserMock = vi.fn();
const signOutMock = vi.fn();
const signInWithPasswordMock = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: getUserMock,
      updateUser: updateUserMock,
      signOut: signOutMock,
      signInWithPassword: signInWithPasswordMock,
    },
    rpc: rpcMock,
    from: fromMock,
  }),
}));

import {
  ProfileActivationError,
  SupabaseAuthService,
} from '../services/supabaseAuthService';

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: '35b167e8-c72d-472e-bff7-d5e6e553a5d3',
    display_name: 'Test Außendienst',
    email: 'post@amrtech.de',
    role: 'field_service',
    status: 'invited',
    sales_team_id: null,
    schema_version: 3,
    deactivated_at: null,
    last_access_at: null,
    created_at: '2026-08-02T00:40:00.000Z',
    updated_at: '2026-08-02T00:40:00.000Z',
    ...overrides,
  };
}

function mockProfileSelect(row: ReturnType<typeof profileRow> | null, error: { code?: string; message: string } | null = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error }),
  };
  fromMock.mockReturnValue(builder);
  return builder;
}

describe('SupabaseAuthService invite callback', () => {
  const service = new SupabaseAuthService();

  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { id: '35b167e8-c72d-472e-bff7-d5e6e553a5d3' } },
      error: null,
    });
    updateUserMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('liest invited-Profil vor Passwort und aktiviert danach per RPC', async () => {
    mockProfileSelect(profileRow());
    rpcMock.mockResolvedValue({
      data: profileRow({ status: 'active', last_access_at: '2026-08-02T01:00:00.000Z' }),
      error: null,
    });

    const result = await service.completeInvitePassword('secure-pass-123');

    expect(result.user.status).toBe('active');
    expect(result.user.role).toBe('field_service');
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'secure-pass-123' });
    expect(rpcMock).toHaveBeenCalledWith('mark_profile_active_on_login');
  });

  it('meldet fehlendes Profil klar', async () => {
    mockProfileSelect(null);

    await expect(service.completeInvitePassword('secure-pass-123')).rejects.toMatchObject({
      code: 'profile_missing',
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('meldet deaktiviertes Profil klar', async () => {
    mockProfileSelect(profileRow({ status: 'deactivated' }));

    await expect(service.completeInvitePassword('secure-pass-123')).rejects.toMatchObject({
      code: 'profile_deactivated',
    });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('meldet RPC-Aktivierungsfehler klar', async () => {
    mockProfileSelect(profileRow());
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'profile not available' },
    });

    await expect(service.completeInvitePassword('secure-pass-123')).rejects.toMatchObject({
      code: 'profile_missing',
    });
  });

  it('meldet abgelaufene Sitzung klar', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });

    await expect(service.completeInvitePassword('secure-pass-123')).rejects.toBeInstanceOf(
      ProfileActivationError,
    );
  });

  it('aktiviert bestehende Sitzung über RPC', async () => {
    rpcMock.mockResolvedValue({
      data: profileRow({ status: 'active' }),
      error: null,
    });

    const user = await service.activateAndLoadProfile();
    expect(user?.status).toBe('active');
  });
});
