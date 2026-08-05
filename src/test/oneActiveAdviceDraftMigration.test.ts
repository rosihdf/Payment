import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../supabase/migrations/20260805200000_one_active_advice_draft_per_lead.sql',
);

describe('One active advice draft migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('bereinigt ältere Dubletten und setzt Unique-Index', () => {
    expect(sql).toContain("status', 'discarded'");
    expect(sql).toContain('best_pay_one_active_advice_draft_per_lead');
    expect(sql).toContain('create unique index');
    expect(sql).toContain('lead_id is not null');
    expect(sql).toContain('offer_id is null');
  });
});
