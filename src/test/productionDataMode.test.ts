import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCoreRepositories } from '../app/providers/createCoreRepositories';
import {
  assertProductionDataModeEnv,
  getDataMode,
  isSupabaseDataMode,
} from '../config/dataMode';
import { loadAppRuntimeConfig, validateAppRuntimeConfig } from '../config/appRuntimeConfig';
import { LocalUserRepository } from '../repositories/local/LocalUserRepository';
import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';
import * as supabaseClient from '../lib/supabaseClient';
import { resetSupabaseClientForTests } from '../lib/supabaseClient';
import * as demoDataService from '../services/demoDataService';

describe('production data mode fail-fast', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetSupabaseClientForTests();
  });

  it('fails when production has no VITE_DATA_MODE', () => {
    expect(() =>
      assertProductionDataModeEnv({
        MODE: 'production',
        VITE_DATA_MODE: '',
        VITE_SUPABASE_URL: 'https://vohnqrftkuefkugabcob.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).toThrow(/VITE_DATA_MODE=supabase/);
  });

  it('fails when production sets local mode', () => {
    expect(() =>
      assertProductionDataModeEnv({
        MODE: 'production',
        VITE_DATA_MODE: 'local',
        VITE_SUPABASE_URL: 'https://vohnqrftkuefkugabcob.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).toThrow(/VITE_DATA_MODE=supabase/);
  });

  it('accepts production supabase env', () => {
    expect(() =>
      assertProductionDataModeEnv({
        MODE: 'production',
        VITE_DATA_MODE: 'supabase',
        VITE_SUPABASE_URL: 'https://vohnqrftkuefkugabcob.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).not.toThrow();
  });

  it('throws at runtime in PROD without supabase mode', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_DATA_MODE', 'local');
    expect(() => getDataMode()).toThrow(/Produktionsbuild erfordert VITE_DATA_MODE=supabase/);
  });

  it('uses supabase repositories in production supabase mode', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');

    expect(isSupabaseDataMode()).toBe(true);
    const core = createCoreRepositories();
    expect(core.userRepository).toBeInstanceOf(SupabaseUserRepository);
    expect(core.userRepository).not.toBeInstanceOf(LocalUserRepository);

    const config = loadAppRuntimeConfig();
    expect(config.persistenceMode).toBe('supabase');
    expect(config.demoMode).toBe(false);
    expect(validateAppRuntimeConfig(config)).toEqual([]);
  });

  it('does not seed demo data when creating supabase core repositories', () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
    const seedSpy = vi.spyOn(demoDataService, 'seedDemoData');

    createCoreRepositories();
    expect(seedSpy).not.toHaveBeenCalled();
  });
});

describe('supabase profile access', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetSupabaseClientForTests();
  });

  function stubAuthClient(options: {
    userId: string | null;
    rpcData?: unknown;
    rpcError?: { message: string } | null;
  }) {
    vi.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: options.userId ? { id: options.userId } : null },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: options.rpcData ?? null,
        error:
          options.rpcError !== undefined
            ? options.rpcError
            : options.rpcData
              ? null
              : { message: 'rpc missing' },
      }),
      from: vi.fn(),
    } as never);
  }

  it('blocks missing profile for authenticated user', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');

    const repo = new SupabaseUserRepository();
    stubAuthClient({ userId: '11111111-1111-1111-1111-111111111111', rpcError: { message: 'fail' } });
    vi.spyOn(repo, 'getById').mockResolvedValue(null);

    await expect(repo.getCurrentUser()).rejects.toThrow(/kein Profil/);
  });

  it('blocks deactivated profile for authenticated user', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');

    const repo = new SupabaseUserRepository();
    stubAuthClient({
      userId: '11111111-1111-1111-1111-111111111111',
      rpcError: { message: 'fail' },
    });
    vi.spyOn(repo, 'getById').mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Michael Rosenau',
      email: 'm.rosenau@amrtech.de',
      role: 'admin',
      status: 'deactivated',
      salesTeamId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deactivatedAt: '2026-07-01T00:00:00.000Z',
      lastAccessAt: null,
      schemaVersion: 3,
    });

    await expect(repo.getCurrentUser()).rejects.toThrow(/deaktiviert/);
  });

  it('loads active profile by auth uuid', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');

    const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const repo = new SupabaseUserRepository();
    stubAuthClient({
      userId: uuid,
      rpcData: {
        user_id: uuid,
        display_name: 'Michael Rosenau',
        email: 'm.rosenau@amrtech.de',
        role: 'admin',
        status: 'active',
        sales_team_id: null,
        schema_version: 3,
        deactivated_at: null,
        last_access_at: '2026-08-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    });

    const user = await repo.getCurrentUser();
    expect(user?.id).toBe(uuid);
    expect(user?.id).not.toBe('user_001');
    expect(user?.name).toBe('Michael Rosenau');
    expect(user?.role).toBe('admin');
  });
});
