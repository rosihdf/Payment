#!/usr/bin/env node
/**
 * Hard cleanup for acceptance/ghost test data in remote Supabase.
 * Requires SUPABASE_SERVICE_ROLE_KEY. Missing/invalid key → exit 1.
 * Never reports success when remnants remain.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ACCEPTANCE_TAG = 'CORE_REPAIR_BROWSER';
const PROTECTED_COMPANY = 'AMRtech UG';

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const entries = {};
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

const url = env.VITE_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function isPlausibleServiceRoleKey(value) {
  if (!value || value.length < 40) return false;
  if (value === 'echo' || value === 'changeme' || value === 'YOUR_SERVICE_ROLE_KEY') return false;
  // Legacy JWT or current sb_secret_* forms
  return value.startsWith('eyJ') || value.startsWith('sb_secret_') || value.includes('.');
}

if (!url || !serviceKey) {
  console.error('Cleanup Abbruch – SUPABASE_SERVICE_ROLE_KEY oder Supabase-URL fehlt.');
  process.exit(1);
}

if (!isPlausibleServiceRoleKey(serviceKey)) {
  console.error(
    'Cleanup Abbruch – SUPABASE_SERVICE_ROLE_KEY ist ungültig (zu kurz oder Platzhalter).',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function preflightServiceRole() {
  const { error } = await supabase.from('leads').select('id', { count: 'exact', head: true });
  if (error) {
    console.error(`Cleanup Abbruch – Service-Role-Preflight fehlgeschlagen: ${error.message}`);
    process.exit(1);
  }
}

function assertOk(label, error) {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

async function countExact(table, build = (q) => q) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  query = build(query);
  const { count, error } = await query;
  assertOk(`${table} zählen`, error);
  if (count == null) {
    throw new Error(`${table} zählen: count ist null`);
  }
  return count;
}

async function selectIds(table, build) {
  let query = supabase.from(table).select('id');
  query = build(query);
  const { data, error } = await query;
  assertOk(`${table} select`, error);
  return (data ?? []).map((row) => row.id).filter(Boolean);
}

async function deleteIn(table, column, ids) {
  if (!ids.length) return;
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { error } = await supabase.from(table).delete().in(column, chunk);
    assertOk(`${table} delete by ${column}`, error);
  }
}

async function deleteAll(table) {
  const { error } = await supabase.from(table).delete().neq('id', '__never__');
  assertOk(`${table} delete all`, error);
}

function isTestLead(lead) {
  if (lead.company_name === PROTECTED_COMPANY) return false;
  const name = lead.company_name ?? '';
  const id = lead.id ?? '';
  return (
    name.includes(ACCEPTANCE_TAG) ||
    name.startsWith('TEST') ||
    name.includes('Phase 1B') ||
    name === '2' ||
    /Beratung ohne Kunde/i.test(name) ||
    /ohne Kundenzuordnung/i.test(name) ||
    id.includes('CORE_REPAIR') ||
    id.includes('test_p1b') ||
    /^lead_test_/i.test(id)
  );
}

async function collectTargets() {
  const { data: leads, error } = await supabase.from('leads').select('id, company_name');
  assertOk('leads inventory', error);
  const testLeadIds = (leads ?? []).filter(isTestLead).map((lead) => lead.id);

  const offerIds = new Set();
  if (testLeadIds.length) {
    for (const id of await selectIds('offers', (q) => q.in('lead_id', testLeadIds))) {
      offerIds.add(id);
    }
  }
  for (const id of await selectIds('offers', (q) =>
    q.or('id.ilike.%test_p1b%,id.ilike.%CORE_REPAIR%,offer_number.ilike.TEST%'),
  )) {
    offerIds.add(id);
  }

  const sessionIds = new Set(
    await selectIds('best_pay_comparison_sessions', (q) => q.is('lead_id', null)),
  );
  if (testLeadIds.length) {
    for (const id of await selectIds('best_pay_comparison_sessions', (q) =>
      q.in('lead_id', testLeadIds),
    )) {
      sessionIds.add(id);
    }
  }
  for (const id of await selectIds('best_pay_comparison_sessions', (q) =>
    q.or(`id.ilike.%${ACCEPTANCE_TAG}%,id.ilike.%test_p1b%`),
  )) {
    sessionIds.add(id);
  }

  return {
    testLeadIds,
    offerIds: [...offerIds],
    sessionIds: [...sessionIds],
  };
}

async function loadLeadIdSet() {
  const { data, error } = await supabase.from('leads').select('id');
  assertOk('leads id set', error);
  return new Set((data ?? []).map((row) => row.id).filter(Boolean));
}

async function selectMissingLeadRefs(table) {
  const leadIds = await loadLeadIdSet();
  const { data, error } = await supabase.from(table).select('id, lead_id');
  assertOk(`${table} orphan scan`, error);
  return (data ?? [])
    .filter((row) => row.lead_id && !leadIds.has(row.lead_id))
    .map((row) => row.id)
    .filter(Boolean);
}

async function remnantReport() {
  const targets = await collectTargets();
  const continueTasks = await countExact('sales_tasks', (q) =>
    q.ilike('source_key', 'auto:continue_calculation:%'),
  );
  const continueByType = await countExact('sales_tasks', (q) =>
    q.contains('data', { type: 'continue_calculation' }),
  );
  const danglingActivities = (await selectMissingLeadRefs('sales_activities')).length;
  const danglingRecommendations = (await selectMissingLeadRefs('recommendation_records')).length;
  const danglingOffers = (await selectMissingLeadRefs('offers')).length;
  return {
    testLeads: targets.testLeadIds.length,
    testOffers: targets.offerIds.length,
    targetSessions: targets.sessionIds.length,
    orphanSessions: await countExact('best_pay_comparison_sessions', (q) => q.is('lead_id', null)),
    orphanActivities: await countExact('sales_activities', (q) => q.is('lead_id', null)),
    orphanRecommendations: await countExact('recommendation_records', (q) => q.is('lead_id', null)),
    danglingActivities,
    danglingRecommendations,
    danglingOffers,
    billingImports: await countExact('billing_import_sessions'),
    continueTasks: continueTasks + continueByType,
  };
}

async function cleanup() {
  await preflightServiceRole();
  const beforeTargets = await collectTargets();
  const before = await remnantReport();
  console.log('Cleanup vorher:', JSON.stringify(before));

  const { offerIds, testLeadIds, sessionIds } = beforeTargets;

  if (offerIds.length) {
    await deleteIn('offer_documents', 'offer_id', offerIds);
    await deleteIn('offer_share_links', 'offer_id', offerIds);
    await deleteIn('offer_customer_questions', 'offer_id', offerIds);
    await deleteIn('offer_change_requests', 'offer_id', offerIds);
    await deleteIn('offer_customer_acceptances', 'offer_id', offerIds);
    await deleteIn('offer_workflow_events', 'offer_id', offerIds);
    await deleteIn('offer_versions', 'offer_id', offerIds);
    await deleteIn('recommendation_records', 'offer_id', offerIds);
    await deleteIn('sales_activities', 'offer_id', offerIds);
    await deleteIn('sales_tasks', 'offer_id', offerIds);
    await deleteIn('billing_import_sessions', 'offer_id', offerIds);
    await deleteIn('offers', 'id', offerIds);
  }

  if (sessionIds.length) {
    await deleteIn('user_active_sessions', 'comparison_session_id', sessionIds);
    await deleteIn('best_pay_comparison_sessions', 'id', sessionIds);
  }

  if (testLeadIds.length) {
    await deleteIn('recommendation_records', 'lead_id', testLeadIds);
    await deleteIn('sales_activities', 'lead_id', testLeadIds);
    await deleteIn('sales_tasks', 'lead_id', testLeadIds);
    await deleteIn('billing_import_sessions', 'lead_id', testLeadIds);
    await deleteIn('lead_contacts', 'lead_id', testLeadIds);
    await deleteIn('best_pay_comparison_sessions', 'lead_id', testLeadIds);
    await deleteIn('leads', 'id', testLeadIds);
  }

  // Remaining ghosts: orphan sessions / null-lead rows / auto continue tasks / all billing imports (only test remnants exist)
  await deleteIn(
    'best_pay_comparison_sessions',
    'id',
    await selectIds('best_pay_comparison_sessions', (q) => q.is('lead_id', null)),
  );
  await deleteIn(
    'sales_activities',
    'id',
    await selectIds('sales_activities', (q) => q.is('lead_id', null)),
  );
  await deleteIn(
    'recommendation_records',
    'id',
    await selectIds('recommendation_records', (q) => q.is('lead_id', null)),
  );
  await deleteIn('sales_activities', 'id', await selectMissingLeadRefs('sales_activities'));
  await deleteIn(
    'recommendation_records',
    'id',
    await selectMissingLeadRefs('recommendation_records'),
  );
  await deleteIn('offers', 'id', await selectMissingLeadRefs('offers'));
  await deleteIn(
    'sales_tasks',
    'id',
    await selectIds('sales_tasks', (q) => q.ilike('source_key', 'auto:continue_calculation:%')),
  );
  await deleteIn(
    'sales_tasks',
    'id',
    await selectIds('sales_tasks', (q) => q.contains('data', { type: 'continue_calculation' })),
  );
  await deleteAll('billing_import_sessions');

  const { data: acquiringRules, error: ruleError } = await supabase
    .from('commission_rules')
    .select('id, data')
    .filter('data->>name', 'eq', 'Nur Acquiring');
  assertOk('commission_rules select', ruleError);
  for (const row of acquiringRules ?? []) {
    const data = row.data && typeof row.data === 'object' ? { ...row.data } : {};
    if (data.fixedAmountCents === 17500) {
      data.fixedAmountCents = 15000;
      data.updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from('commission_rules')
        .update({ data, updated_at: data.updatedAt })
        .eq('id', row.id);
      assertOk('commission_rules restore Nur Acquiring', error);
      console.log('Provision Nur Acquiring: 17500 → 15000 ct');
    }
  }

  const after = await remnantReport();
  console.log('Cleanup nachher:', JSON.stringify(after));

  const failed = Object.entries(after).filter(([, value]) => value > 0);
  if (failed.length > 0) {
    console.error(
      'Cleanup fehlgeschlagen – Reste:',
      failed.map(([key, value]) => `${key}=${value}`).join(', '),
    );
    process.exit(1);
  }

  const { count: protectedCount, error: protectedError } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('company_name', PROTECTED_COMPANY);
  assertOk('protected lead check', protectedError);
  console.log(`Cleanup OK – Testreste 0. Geschützt: ${PROTECTED_COMPANY} (${protectedCount ?? 0})`);
}

cleanup().catch((error) => {
  console.error('Cleanup fehlgeschlagen:', error instanceof Error ? error.message : error);
  process.exit(1);
});
