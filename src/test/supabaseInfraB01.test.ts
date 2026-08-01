import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAppRuntimeConfig, validateAppRuntimeConfig } from '../config/appRuntimeConfig';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { LocalUserRepository } from '../repositories/local/LocalUserRepository';
import { SupabaseLeadRepository } from '../repositories/supabase/SupabaseLeadRepository';
import { SupabaseProductRepository } from '../repositories/supabase/SupabaseProductRepository';
import { SupabaseTariffRepository } from '../repositories/supabase/SupabaseTariffRepository';
import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';
import { resetSupabaseClientForTests } from '../lib/supabaseClient';

describe('supabase infra block 1', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetSupabaseClientForTests();
  });

  it('keeps local repositories as default and no silent supabase switch', () => {
    vi.stubEnv('VITE_DATA_MODE', 'local');
    expect(new LocalUserRepository()).toBeInstanceOf(LocalUserRepository);
    expect(new LocalLeadRepository()).toBeInstanceOf(LocalLeadRepository);
    expect(new LocalTariffRepository()).toBeInstanceOf(LocalTariffRepository);
    expect(new LocalProductRepository()).toBeInstanceOf(LocalProductRepository);
    expect(loadAppRuntimeConfig().persistenceMode).toBe('local');
    expect(loadAppRuntimeConfig().demoMode).toBe(true);
  });

  it('uses supabase repositories when mode is supabase and env is present', () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');

    expect(new SupabaseUserRepository()).toBeInstanceOf(SupabaseUserRepository);
    expect(new SupabaseLeadRepository()).toBeInstanceOf(SupabaseLeadRepository);
    expect(new SupabaseTariffRepository()).toBeInstanceOf(SupabaseTariffRepository);
    expect(new SupabaseProductRepository()).toBeInstanceOf(SupabaseProductRepository);

    const config = loadAppRuntimeConfig();
    expect(config.persistenceMode).toBe('supabase');
    expect(config.authMode).toBe('supabase');
    expect(config.demoMode).toBe(false);
    expect(validateAppRuntimeConfig(config)).toEqual([]);
  });

  it('fails loudly when supabase mode lacks env (no local fallback)', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    const repo = new SupabaseUserRepository();
    await expect(repo.getAll()).rejects.toThrow(/Supabase-Modus aktiv|fehlt|Ungültige/);
  });

  it('rejects demo user switching away from auth session', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');

    const repo = new SupabaseUserRepository();
    vi.spyOn(repo, 'getCurrentUser').mockResolvedValue({
      id: 'auth-user-1',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      salesTeamId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deactivatedAt: null,
      lastAccessAt: null,
      schemaVersion: 3,
    });

    await expect(repo.setCurrentUser('other-user')).rejects.toThrow(/Benutzerwechsel nur über Anmeldung/);
  });
});
