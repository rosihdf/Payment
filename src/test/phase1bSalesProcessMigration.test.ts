import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../supabase/migrations/20260802230000_phase1b_sales_process.sql',
);

const PHASE1B_TABLES = [
  'offer_share_links',
  'offer_customer_questions',
  'offer_change_requests',
  'offer_customer_acceptances',
  'bestpay_handoffs',
];

describe('Phase 1B sales process migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('legt alle Block-2-Tabellen an', () => {
    for (const table of PHASE1B_TABLES) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it('erzwingt eindeutigen Token-Hash und einen aktiven Share je Angebot', () => {
    expect(sql).toContain('constraint offer_share_links_token_hash_uidx unique (token_hash)');
    expect(sql).toContain('offer_share_links_one_active_per_offer');
    expect(sql).toContain("where status = 'active'");
  });

  it('aktiviert RLS und entzieht anonymen Zugriff', () => {
    for (const table of PHASE1B_TABLES) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on public.${table} from anon`);
    }
  });

  it('nutzt can_access_offer für authentifizierte Zugriffe', () => {
    expect(sql).toContain('public.can_access_offer(offer_id)');
  });
});
