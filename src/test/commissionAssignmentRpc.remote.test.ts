/**
 * Direkte RPC-Nachweise gegen das Remote-Projekt.
 * Nicht Teil von `npm test` – ausführen mit `npm run test:remote`.
 * Übersprungen ohne Service-Role / Credentials / Phase-2D-Regeln auf Remote.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const entries: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[trimmed.slice(0, eq).trim()] = value;
  }
  return entries;
}

const env = {
  ...parseEnvFile(resolve(ROOT, '.env.local')),
  ...parseEnvFile(resolve(ROOT, '.env.supabase.acceptance.local')),
  ...parseEnvFile(resolve(homedir(), '.amrtech-payment-leads.acceptance.env')),
  ...parseEnvFile(resolve(homedir(), '.amrtech-payment-leads.service-role.env')),
  ...process.env,
};

const URL = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
const ANON = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
const SERVICE = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const ADMIN_EMAIL = (env.SUPABASE_TEST_EMAIL || '').trim();
const ADMIN_PASSWORD = (env.SUPABASE_TEST_PASSWORD || '').trim();
const FIELD_EMAIL = (env.SUPABASE_TEST_FIELD_EMAIL || '').trim();
const FIELD_PASSWORD = (env.SUPABASE_TEST_FIELD_PASSWORD || '').trim();

const enabled = Boolean(URL && ANON && SERVICE && ADMIN_EMAIL && ADMIN_PASSWORD && FIELD_EMAIL);

const PHASE2D_CLASSIC_RULE_IDS = [
  'commission_rule_classic_acq',
  'commission_rule_classic_terminal_acq_long',
  'commission_rule_classic_terminal_short',
] as const;

const STANDARD_OVERRIDES = [
  {
    ruleId: 'commission_rule_classic_acq',
    sharePercent: 100,
    fixedAmountCents: null,
    percentTenthsOfBasisPoint: null,
  },
  {
    ruleId: 'commission_rule_classic_terminal_acq_long',
    sharePercent: 100,
    fixedAmountCents: null,
    percentTenthsOfBasisPoint: null,
  },
  {
    ruleId: 'commission_rule_classic_terminal_short',
    sharePercent: 100,
    fixedAmountCents: null,
    percentTenthsOfBasisPoint: null,
  },
];

describe.runIf(enabled)('Commission assignment RPC (remote)', () => {
  let admin: SupabaseClient;
  let field: SupabaseClient;
  let service: SupabaseClient;
  let fieldUserId = '';
  let remoteCatalogReady = false;

  beforeAll(async () => {
    admin = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    field = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    service = createClient(URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const adminLogin = await admin.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminLogin.error).toBeNull();

    const fieldLogin = await field.auth.signInWithPassword({
      email: FIELD_EMAIL,
      password: FIELD_PASSWORD,
    });
    expect(fieldLogin.error).toBeNull();
    fieldUserId = fieldLogin.data.user?.id ?? '';
    expect(fieldUserId).toBeTruthy();

    const { data: rules, error: rulesError } = await service
      .from('commission_rules')
      .select('id')
      .in('id', [...PHASE2D_CLASSIC_RULE_IDS]);
    expect(rulesError).toBeNull();
    const found = new Set((rules ?? []).map((row) => row.id));
    remoteCatalogReady = PHASE2D_CLASSIC_RULE_IDS.every((id) => found.has(id));
  }, 60_000);

  function requireRemoteCatalogReady(context: { skip: () => void }) {
    if (!remoteCatalogReady) {
      context.skip();
    }
  }

  async function currentVersionCount(): Promise<number> {
    const { count, error } = await service
      .from('commission_assignment_versions')
      .select('id', { count: 'exact', head: true })
      .eq('sales_representative_id', fieldUserId);
    expect(error).toBeNull();
    return count ?? 0;
  }

  async function save(overrides: typeof STANDARD_OVERRIDES, note: string, expected?: string | null) {
    const { data, error } = await admin.rpc('save_commission_assignment_version', {
      p_sales_representative_id: fieldUserId,
      p_commission_plan_version_id: 'commission_plan_version_classic_v1',
      p_valid_from: '2026-01-01',
      p_valid_until: null,
      p_rule_overrides: overrides,
      p_change_note: note,
      p_expected_current_version_id: expected ?? null,
    });
    expect(error).toBeNull();
    return data as Record<string, unknown>;
  }

  it('speichert 42 %, erkennt unveränderte Eingabe und setzt auf Standard zurück', async (context) => {
    requireRemoteCatalogReady(context);
    const before = await currentVersionCount();
    const fortyTwo = STANDARD_OVERRIDES.map((entry) =>
      entry.ruleId === 'commission_rule_classic_acq'
        ? { ...entry, sharePercent: 42 }
        : entry,
    );

    const created = await save(fortyTwo, 'rpc-test-42');
    expect(created.ok, JSON.stringify(created)).toBe(true);
    expect(created.changed).toBe(true);
    expect(created.unchanged).toBe(false);

    const again = await save(fortyTwo, 'rpc-test-42-again');
    expect(again.ok).toBe(true);
    expect(again.unchanged).toBe(true);

    const afterSame = await currentVersionCount();
    expect(afterSame).toBe(before + 1);

    const reset = await save(STANDARD_OVERRIDES, 'rpc-test-reset');
    expect(reset.ok).toBe(true);
    expect(reset.changed).toBe(true);
    expect(reset.isDefault).toBe(true);
  }, 60_000);

  it('lehnt Außendienst-Schreibversuch kontrolliert ab', async (context) => {
    requireRemoteCatalogReady(context);
    const before = await currentVersionCount();
    const { data, error } = await field.rpc('save_commission_assignment_version', {
      p_sales_representative_id: fieldUserId,
      p_commission_plan_version_id: 'commission_plan_version_classic_v1',
      p_valid_from: '2026-01-01',
      p_valid_until: null,
      p_rule_overrides: STANDARD_OVERRIDES.map((entry) =>
        entry.ruleId === 'commission_rule_classic_acq'
          ? { ...entry, sharePercent: 55 }
          : entry,
      ),
      p_change_note: 'field-forbidden',
      p_expected_current_version_id: null,
    });
    expect(error).toBeNull();
    expect((data as { ok?: boolean; error?: string }).ok).toBe(false);
    expect((data as { error?: string }).error).toBe('forbidden');
    expect(await currentVersionCount()).toBe(before);
  }, 60_000);

  it('parallele identische Aufrufe erzeugen höchstens eine neue Version', async (context) => {
    requireRemoteCatalogReady(context);
    const payload = STANDARD_OVERRIDES.map((entry) =>
      entry.ruleId === 'commission_rule_classic_acq'
        ? { ...entry, sharePercent: 33 }
        : entry,
    );
    await save(STANDARD_OVERRIDES, 'rpc-parallel-base');
    const before = await currentVersionCount();

    const [first, second] = await Promise.all([
      save(payload, 'rpc-parallel-a'),
      save(payload, 'rpc-parallel-b'),
    ]);

    expect(first.ok || second.ok).toBe(true);
    const after = await currentVersionCount();
    expect(after - before).toBe(1);

    await save(STANDARD_OVERRIDES, 'rpc-parallel-cleanup');
  }, 60_000);

  it('Versionskonflikt bei erwarteter veralteter Version', async (context) => {
    requireRemoteCatalogReady(context);
    const first = await save(
      STANDARD_OVERRIDES.map((entry) =>
        entry.ruleId === 'commission_rule_classic_acq'
          ? { ...entry, sharePercent: 10 }
          : entry,
      ),
      'rpc-conflict-a',
    );
    expect(first.ok).toBe(true);
    const expected = String(first.currentVersionId);

    const second = await save(
      STANDARD_OVERRIDES.map((entry) =>
        entry.ruleId === 'commission_rule_classic_acq'
          ? { ...entry, sharePercent: 20 }
          : entry,
      ),
      'rpc-conflict-b',
    );
    expect(second.ok).toBe(true);

    const conflict = await save(
      STANDARD_OVERRIDES.map((entry) =>
        entry.ruleId === 'commission_rule_classic_acq'
          ? { ...entry, sharePercent: 30 }
          : entry,
      ),
      'rpc-conflict-stale',
      expected,
    );
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toBe('version_conflict');

    await save(STANDARD_OVERRIDES, 'rpc-conflict-cleanup');
  }, 60_000);
});
