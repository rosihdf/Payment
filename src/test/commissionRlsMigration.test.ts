import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../supabase/migrations/20260802103000_commission_rls.sql',
);

const COMMISSION_TABLES = [
  'commission_plans',
  'commission_plan_versions',
  'commission_rules',
  'commission_assignments',
  'commission_assignment_versions',
  'commission_calculations',
  'commission_cases',
  'commission_events',
  'commission_bonus_payments',
  'commission_payment_history',
];

describe('Commission RLS migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('aktiviert RLS auf allen Commission-Tabellen', () => {
    for (const table of COMMISSION_TABLES) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('entzieht anonymen Grants', () => {
    expect(sql).toContain("revoke all on public.%I from anon");
  });

  it('nutzt aktive-Profil-Prüfung und Admin-Gates', () => {
    expect(sql).toContain('is_active_commission_user()');
    expect(sql).toContain('can_access_commission_case');
    expect(sql).toContain('owns_commission_rep');
    expect(sql).not.toContain('authenticated = true');
  });

  it('trennt Admin-Mutation von Außendienst-Lesezugriff', () => {
    expect(sql).toContain('commission_calculations_admin');
    expect(sql).toContain('commission_cases_admin');
    expect(sql).toContain('drop policy if exists commission_calculations_mutate');
    expect(sql).toContain('drop policy if exists commission_cases_mutate');
  });
});
