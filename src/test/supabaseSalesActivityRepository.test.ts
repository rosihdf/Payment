import { describe, expect, it, vi } from 'vitest';
import { SupabaseSalesActivityRepository } from '../repositories/supabase/SupabaseSalesActivityRepository';
import * as supabaseTable from '../repositories/supabase/supabaseTable';

describe('SupabaseSalesActivityRepository', () => {
  it('normalisiert Activities ohne id im JSON über Tabellenspalten', async () => {
    vi.spyOn(supabaseTable, 'sbSelectAll').mockResolvedValue([
      {
        id: 'sales_activity_8095bc61-9079-4cd6-bc26-af0591c91373',
        created_by_user_id: 'ef9cba97-3eb5-4b28-9fa2-98a027be42e5',
        lead_id: 'lead_test_p1b_smoke_20260802',
        offer_id: 'offer_test_p1b_smoke_20260802',
        contract_id: null,
        activation_id: null,
        created_at: '2026-08-02T22:13:51.531Z',
        data: {
          type: 'status_change',
          title: 'Kunde hat Angebot geöffnet',
          description: 'Erster Zugriff über den Kundenlink.',
          occurredAt: '2026-08-02T22:13:51.531Z',
          createdByUserId: 'ef9cba97-3eb5-4b28-9fa2-98a027be42e5',
          leadId: 'lead_test_p1b_smoke_20260802',
          offerId: 'offer_test_p1b_smoke_20260802',
          isSystem: true,
          editable: false,
          sourceKey: 'offer_share_first_access:offer_share_test_p1b_1',
          createdAt: '2026-08-02T22:13:51.531Z',
          updatedAt: '2026-08-02T22:13:51.531Z',
          schemaVersion: 1,
        },
      },
    ]);

    const repo = new SupabaseSalesActivityRepository();
    const activities = await repo.getAll();

    expect(activities).toHaveLength(1);
    expect(activities[0]?.id).toBe('sales_activity_8095bc61-9079-4cd6-bc26-af0591c91373');
    expect(activities[0]?.type).toBe('status_change');
    expect(activities[0]?.sourceKey).toBe('offer_share_first_access:offer_share_test_p1b_1');
  });

  it('überspringt unnormalisierbare Datensätze ohne die gesamte Liste zu blockieren', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(supabaseTable, 'sbSelectAll').mockResolvedValue([
      {
        id: 'sales_activity_valid',
        created_by_user_id: 'user-1',
        lead_id: null,
        offer_id: null,
        contract_id: null,
        activation_id: null,
        created_at: '2026-08-02T22:13:51.531Z',
        data: {
          id: 'sales_activity_valid',
          type: 'note',
          title: 'Gültig',
          description: '',
          occurredAt: '2026-08-02T22:13:51.531Z',
          createdByUserId: 'user-1',
          leadId: null,
          offerId: null,
          isSystem: false,
          editable: true,
          sourceKey: null,
          createdAt: '2026-08-02T22:13:51.531Z',
          updatedAt: '2026-08-02T22:13:51.531Z',
          schemaVersion: 1,
        },
      },
      {
        id: 'sales_activity_invalid',
        created_by_user_id: null,
        lead_id: null,
        offer_id: null,
        contract_id: null,
        activation_id: null,
        created_at: '2026-08-02T22:13:51.531Z',
        data: { title: 'Ohne Pflichtfelder' },
      },
    ]);

    const repo = new SupabaseSalesActivityRepository();
    const activities = await repo.getAll();

    expect(activities).toHaveLength(1);
    expect(activities[0]?.id).toBe('sales_activity_valid');
    expect(warnSpy).toHaveBeenCalledWith(
      'SalesActivity konnte nicht normalisiert werden: sales_activity_invalid',
    );
  });
});
