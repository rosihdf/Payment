import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../supabase/migrations/20260805120000_save_commission_assignment_version_rpc.sql',
);

describe('Commission assignment atomic RPC migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('definiert save_commission_assignment_version als SECURITY DEFINER mit sicherem search_path', () => {
    expect(sql).toContain('create or replace function public.save_commission_assignment_version(');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = public');
  });

  it('prüft Adminrechte serverseitig und lehnt Außendienst ab', () => {
    expect(sql).toContain('is_admin()');
    expect(sql).toContain("error', 'forbidden'");
    expect(sql).toContain("error', 'unauthenticated'");
  });

  it('deckt Idempotenz, Versionskonflikt und atomare Writes ab', () => {
    expect(sql).toContain("'unchanged', true");
    expect(sql).toContain("error', 'version_conflict'");
    expect(sql).toContain('insert into public.commission_assignment_versions');
    expect(sql).toContain('insert into public.audit_entries');
    expect(sql).toContain('for update');
  });

  it('vergibt Execute nur an authenticated und service_role', () => {
    expect(sql).toContain('revoke all on function public.save_commission_assignment_version');
    expect(sql).toContain('from anon');
    expect(sql).toContain('to authenticated, service_role');
  });
});
