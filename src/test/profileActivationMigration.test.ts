import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../supabase/migrations/20260802130000_fix_profile_activation_trigger.sql',
);

describe('Profile activation migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('setzt Aktivierungs-Flag in mark_profile_active_on_login', () => {
    expect(sql).toContain("set_config('app.profile_activation', '1', true)");
    expect(sql).toContain("status = case when status = 'invited' then 'active' else status end");
  });

  it('erlaubt invited→active im Privilege-Guard nur über RPC-Flag', () => {
    expect(sql).toContain("current_setting('app.profile_activation', true) = '1'");
    expect(sql).toContain('role/status change not allowed');
  });

  it('behält RPC nur für authenticated und service_role', () => {
    expect(sql).toContain('grant execute on function public.mark_profile_active_on_login() to authenticated, service_role');
    expect(sql).toContain('revoke all on function public.mark_profile_active_on_login() from anon');
  });
});
