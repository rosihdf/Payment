#!/usr/bin/env node
/**
 * Remote-Nachweis für Kernreparatur-Pfade gegen die finale Supabase-Instanz.
 * Verwendet ausschließlich CORE_REPAIR_TEST-* Kennzeichnungen und bereinigt danach.
 *
 * Erfordert SUPABASE_SERVICE_ROLE_KEY (nicht committen) zusätzlich zu .env.local.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_LOCAL = resolve(ROOT, '.env.local');

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }
  const entries = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    entries[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return entries;
}

const env = { ...loadEnvFile(ENV_LOCAL), ...process.env };
const url = env.VITE_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !url.includes('vohnqrftkuefkugabcob')) {
  console.error('supabase-core-repair-verify: VITE_SUPABASE_URL fehlt oder ist ungültig.');
  process.exit(1);
}

if (!serviceKey) {
  console.error(
    'supabase-core-repair-verify: SUPABASE_SERVICE_ROLE_KEY fehlt – Remote-Nachweis übersprungen.',
  );
  process.exit(2);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const TEST_USER = 'CORE_REPAIR_TEST_USER';
const TEST_SESSION = 'CORE_REPAIR_TEST_SESSION';
const TEST_LEAD = 'CORE_REPAIR_TEST_LEAD';

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`OK  ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
}

async function cleanup() {
  await supabase.from('user_active_sessions').delete().eq('user_id', TEST_USER);
  await supabase.from('best_pay_comparison_sessions').delete().eq('id', TEST_SESSION);
  await supabase.from('leads').delete().eq('id', TEST_LEAD);
}

async function verifyFkOrder() {
  await cleanup();
  const now = new Date().toISOString();
  const sessionPayload = {
    id: TEST_SESSION,
    created_by_user_id: TEST_USER,
    lead_id: null,
    offer_id: null,
    data: {
      id: TEST_SESSION,
      title: 'CORE_REPAIR_TEST Beratung',
      entryMode: 'wizard',
      wizard: { enabled: true },
    },
    created_at: now,
    updated_at: now,
  };

  const { error: sessionError } = await supabase
    .from('best_pay_comparison_sessions')
    .insert(sessionPayload);
  if (sessionError) {
    fail('Beratung: Session zuerst speichern', sessionError.message);
    return;
  }
  pass('Beratung: Session zuerst speichern');

  const { error: activeError } = await supabase.from('user_active_sessions').upsert(
    {
      user_id: TEST_USER,
      comparison_session_id: TEST_SESSION,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (activeError) {
    fail('Beratung: Aktivzeiger danach', activeError.message);
    return;
  }
  pass('Beratung: Aktivzeiger danach (FK erfüllt)');

  const { error: wrongOrderError } = await supabase.from('user_active_sessions').upsert(
    {
      user_id: `${TEST_USER}_orphan`,
      comparison_session_id: 'CORE_REPAIR_TEST_MISSING_SESSION',
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (wrongOrderError?.message?.includes('foreign key')) {
    pass('Beratung: FK blockiert fehlende Session', wrongOrderError.message.split('\n')[0]);
  } else if (wrongOrderError) {
    fail('Beratung: FK blockiert fehlende Session', wrongOrderError.message);
  } else {
    fail('Beratung: FK blockiert fehlende Session', 'FK-Verletzung wurde nicht ausgelöst');
  }

  await supabase.from('user_active_sessions').delete().eq('user_id', `${TEST_USER}_orphan`);
}

async function verifyLeadAdvisor() {
  const now = new Date().toISOString();
  await supabase.from('leads').delete().eq('id', TEST_LEAD);

  const { error: insertError } = await supabase.from('leads').insert({
    id: TEST_LEAD,
    company_name: 'CORE_REPAIR_TEST GmbH',
    assigned_sales_user_id: 'user_001',
    created_by_user_id: 'user_004',
    status: 'active',
    data: {
      id: TEST_LEAD,
      companyName: 'CORE_REPAIR_TEST GmbH',
      assignedSalesUserId: 'user_001',
      status: 'active',
    },
    created_at: now,
    updated_at: now,
  });
  if (insertError) {
    fail('Kunde: Testlead anlegen', insertError.message);
    return;
  }
  pass('Kunde: Testlead mit Betreuer angelegt');

  const { data, error } = await supabase
    .from('leads')
    .select('assigned_sales_user_id, company_name')
    .eq('id', TEST_LEAD)
    .maybeSingle();
  if (error || data?.assigned_sales_user_id !== 'user_001') {
    fail('Kunde: Betreuer remote lesbar', error?.message ?? `Got ${data?.assigned_sales_user_id}`);
  } else {
    pass('Kunde: Betreuer remote lesbar', data.company_name);
  }
}

async function verifyCommissionRulePath() {
  const { data, error } = await supabase
    .from('commission_rules')
    .select('id, data')
    .limit(3);
  if (error) {
    fail('Provision: commission_rules lesen', error.message);
    return;
  }
  const withDisplay = (data ?? []).find(
    (row) => row.data && typeof row.data === 'object' && 'displaySharePercent' in row.data,
  );
  if (withDisplay) {
    pass('Provision: displaySharePercent in JSONB vorhanden', withDisplay.id);
  } else {
    pass('Provision: commission_rules lesbar', `${data?.length ?? 0} Regeln`);
  }
}

async function main() {
  console.log('Supabase Kernreparatur – Remote-Nachweis');
  console.log(`Projekt: vohnqrftkuefkugabcob`);
  console.log(`Zeitpunkt: ${new Date().toISOString()}\n`);

  try {
    await verifyFkOrder();
    await verifyLeadAdvisor();
    await verifyCommissionRulePath();
  } finally {
    await cleanup();
  }

  const failed = results.filter((entry) => !entry.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} Prüfung(en) fehlgeschlagen.`);
    process.exit(1);
  }
  console.log(`\nAlle ${results.length} Remote-Prüfungen bestanden.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
