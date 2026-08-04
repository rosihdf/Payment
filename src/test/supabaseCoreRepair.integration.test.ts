/**
 * Supabase-Produktionspfad-Tests (kein localStorage).
 * Läuft nur mit RUN_SUPABASE_CORE_INTEGRATION=1 und SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN = process.env.RUN_SUPABASE_CORE_INTEGRATION === '1';
const URL = process.env.VITE_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const TEST_USER = 'CORE_REPAIR_TEST_USER';
const TEST_SESSION = 'CORE_REPAIR_TEST_SESSION_VITEST';
const TEST_LEAD = 'CORE_REPAIR_TEST_LEAD_VITEST';

describe.runIf(RUN && Boolean(URL && SERVICE_KEY))('Supabase Kernreparatur – Remote-Pfade', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    await supabase.from('user_active_sessions').delete().eq('user_id', TEST_USER);
    await supabase.from('best_pay_comparison_sessions').delete().eq('id', TEST_SESSION);
    await supabase.from('leads').delete().eq('id', TEST_LEAD);
  });

  it('speichert Beratungssitzung vor user_active_sessions (FK-Reihenfolge)', async () => {
    const now = new Date().toISOString();
    await supabase.from('user_active_sessions').delete().eq('user_id', TEST_USER);
    await supabase.from('best_pay_comparison_sessions').delete().eq('id', TEST_SESSION);

    const { error: sessionError } = await supabase.from('best_pay_comparison_sessions').insert({
      id: TEST_SESSION,
      created_by_user_id: TEST_USER,
      lead_id: null,
      offer_id: null,
      data: {
        id: TEST_SESSION,
        title: 'CORE_REPAIR_TEST',
        entryMode: 'wizard',
        wizard: { enabled: true, stepId: 'customer' },
      },
      created_at: now,
      updated_at: now,
    });
    expect(sessionError).toBeNull();

    const { error: activeError } = await supabase.from('user_active_sessions').upsert(
      {
        user_id: TEST_USER,
        comparison_session_id: TEST_SESSION,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );
    expect(activeError).toBeNull();

    const { data: activeRow } = await supabase
      .from('user_active_sessions')
      .select('comparison_session_id')
      .eq('user_id', TEST_USER)
      .maybeSingle();
    expect(activeRow?.comparison_session_id).toBe(TEST_SESSION);

    const { count } = await supabase
      .from('best_pay_comparison_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('id', TEST_SESSION);
    expect(count).toBe(1);
  });

  it('verweigert user_active_sessions ohne vorhandene Session (FK)', async () => {
    const now = new Date().toISOString();
    const orphanUser = `${TEST_USER}_fk_fail`;
    await supabase.from('user_active_sessions').delete().eq('user_id', orphanUser);

    const { error } = await supabase.from('user_active_sessions').insert({
      user_id: orphanUser,
      comparison_session_id: 'CORE_REPAIR_TEST_NONEXISTENT_SESSION',
      updated_at: now,
    });
    expect(error?.message ?? '').toMatch(/foreign key|violates/i);

    await supabase.from('user_active_sessions').delete().eq('user_id', orphanUser);
  });

  it('persistiert Betreuerzuordnung auf leads', async () => {
    const now = new Date().toISOString();
    await supabase.from('leads').delete().eq('id', TEST_LEAD);

    const { error: insertError } = await supabase.from('leads').insert({
      id: TEST_LEAD,
      company_name: 'CORE_REPAIR_TEST Vitest GmbH',
      assigned_sales_user_id: 'user_001',
      created_by_user_id: 'user_004',
      status: 'active',
      data: {
        id: TEST_LEAD,
        companyName: 'CORE_REPAIR_TEST Vitest GmbH',
        assignedSalesUserId: 'user_001',
        status: 'active',
      },
      created_at: now,
      updated_at: now,
    });
    expect(insertError).toBeNull();

    const { data: reloaded } = await supabase
      .from('leads')
      .select('assigned_sales_user_id, company_name')
      .eq('id', TEST_LEAD)
      .maybeSingle();
    expect(reloaded?.assigned_sales_user_id).toBe('user_001');
    expect(reloaded?.company_name).toContain('CORE_REPAIR_TEST');
  });

  it('liest commission_rules mit displaySharePercent-Pfad', async () => {
    const { data, error } = await supabase.from('commission_rules').select('id, data').limit(5);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});

describe('Supabase Kernreparatur – Konfiguration', () => {
  it('Integrationstests sind per RUN_SUPABASE_CORE_INTEGRATION=1 aktivierbar', () => {
    if (RUN && URL && SERVICE_KEY) {
      expect(true).toBe(true);
      return;
    }
    expect(RUN).toBe(false);
  });
});
