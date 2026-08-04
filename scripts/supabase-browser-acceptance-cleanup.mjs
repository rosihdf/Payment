#!/usr/bin/env node
/**
 * Bereinigt CORE_REPAIR_BROWSER-Testdaten aus der Remote-Supabase-DB.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TAG = 'CORE_REPAIR_BROWSER';

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
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

const env = {
  ...parseEnvFile(resolve(ROOT, '.env.local')),
  ...parseEnvFile(resolve(ROOT, '.env.supabase.acceptance.local')),
  ...process.env,
};

const url = env.VITE_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.log('Cleanup übersprungen – SUPABASE_SERVICE_ROLE_KEY nicht verfügbar.');
  process.exit(0);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function cleanup() {
  const { data: leads } = await supabase
    .from('leads')
    .select('id')
    .or(`company_name.ilike.%${TAG}%,id.ilike.%${TAG}%`);

  const leadIds = (leads ?? []).map((row) => row.id);

  if (leadIds.length > 0) {
    const { data: offers } = await supabase.from('offers').select('id').in('lead_id', leadIds);
    const offerIds = (offers ?? []).map((row) => row.id);
    if (offerIds.length > 0) {
      await supabase.from('offer_versions').delete().in('offer_id', offerIds);
      await supabase.from('offers').delete().in('id', offerIds);
    }
    await supabase.from('best_pay_comparison_sessions').delete().in('lead_id', leadIds);
    await supabase.from('leads').delete().in('id', leadIds);
  }

  await supabase.from('best_pay_comparison_sessions').delete().ilike('id', `%${TAG}%`);
  await supabase.from('user_active_sessions').delete().ilike('user_id', `%${TAG}%`);

  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .ilike('company_name', `%${TAG}%`);

  console.log(`Cleanup OK – verbleibende ${TAG}-Leads: ${count ?? 0}`);
}

cleanup().catch((error) => {
  console.error('Cleanup fehlgeschlagen:', error instanceof Error ? error.message : error);
  process.exit(1);
});
