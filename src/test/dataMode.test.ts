import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDataMode, isSupabaseDataMode, requireSupabaseEnv } from '../config/dataMode';
import { resetSupabaseClientForTests } from '../lib/supabaseClient';

describe('dataMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetSupabaseClientForTests();
  });

  it('defaults to local mode in development', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_DATA_MODE', '');
    expect(getDataMode()).toBe('local');
    expect(isSupabaseDataMode()).toBe(false);
  });

  it('activates supabase mode only for explicit value', () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    expect(getDataMode()).toBe('supabase');
    expect(isSupabaseDataMode()).toBe(true);
  });

  it('requires final supabase env in supabase mode', () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    expect(() => requireSupabaseEnv()).toThrow(/VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY/);
  });

  it('rejects non-final supabase project urls', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://other-project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    expect(() => requireSupabaseEnv()).toThrow(/finale Projektinstanz/);
  });

  it('accepts final project url and publishable key', () => {
    vi.stubEnv(
      'VITE_SUPABASE_URL',
      'https://vohnqrftkuefkugabcob.supabase.co',
    );
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
    expect(requireSupabaseEnv()).toEqual({
      url: 'https://vohnqrftkuefkugabcob.supabase.co',
      publishableKey: 'sb_publishable_test_key',
    });
  });
});
