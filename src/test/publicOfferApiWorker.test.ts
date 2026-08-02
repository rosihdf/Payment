import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

import { routePublicOfferApi } from '../../workers/amrtech-payment/src/publicOfferApi';
import type { AdminEnv } from '../../workers/amrtech-payment/src/adminUsersApi';

function env(): AdminEnv {
  return {
    SUPABASE_URL: 'https://vohnqrftkuefkugabcob.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-test-key',
  };
}

function buildShareRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'share_1',
    offer_id: 'offer_1',
    offer_version_id: 'ver_1',
    token_hash: 'abc',
    status: 'active',
    valid_from: '2026-01-01T00:00:00.000Z',
    valid_until: '2027-01-01T00:00:00.000Z',
    revoked_at: null,
    superseded_at: null,
    access_count: 0,
    last_accessed_at: null,
    created_by_user_id: 'user_001',
    data: {},
    ...overrides,
  };
}

function buildClient(options: {
  share?: Record<string, unknown> | null;
  offer?: Record<string, unknown> | null;
  version?: Record<string, unknown> | null;
  documents?: Array<{ id: string; data: Record<string, unknown> }>;
  existingActivity?: { id: string } | null;
}) {
  const updateShare = vi.fn().mockResolvedValue({ error: null });
  const insertActivity = vi.fn().mockResolvedValue({ error: null });
  const insertQuestion = vi.fn().mockResolvedValue({ error: null });
  const insertChange = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => {
        if (table === 'offer_share_links') {
          return { data: options.share ?? null, error: null };
        }
        if (table === 'offers') {
          return { data: options.offer ?? null, error: null };
        }
        if (table === 'offer_versions') {
          return { data: options.version ?? null, error: null };
        }
        if (table === 'profiles') {
          return { data: { display_name: 'Laura' }, error: null };
        }
        if (table === 'sales_activities') {
          return { data: options.existingActivity ?? null, error: null };
        }
        return { data: null, error: null };
      }),
      update: vi.fn(() => ({ eq: updateShare })),
      insert: vi.fn((payload: unknown) => {
        if (table === 'sales_activities') insertActivity(payload);
        if (table === 'offer_customer_questions') insertQuestion(payload);
        if (table === 'offer_change_requests') insertChange(payload);
        return { error: null };
      }),
    };
    if (table === 'offer_documents') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({
            data: options.documents ?? [],
            error: null,
          })),
        })),
      };
    }
    return builder;
  });

  createClientMock.mockReturnValue({ from });
  return { updateShare, insertActivity, insertQuestion, insertChange };
}

describe('publicOfferApi worker routes', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('liefert 404 für unbekannten Token', async () => {
    buildClient({ share: null });
    const response = await routePublicOfferApi(
      new Request('https://example.test/api/public/offers/unknown-token-value-1234567890'),
      env(),
    );
    expect(response?.status).toBe(404);
  });

  it('liefert öffentliche Angebotsdaten für gültigen Link', async () => {
    buildClient({
      share: buildShareRow(),
      offer: {
        id: 'offer_1',
        lead_id: 'lead_1',
        data: { workflowStatus: 'ready_to_send', currentVersionId: 'ver_1' },
      },
      version: {
        id: 'ver_1',
        version_number: 1,
        created_at: '2026-08-02T10:00:00.000Z',
        data: {
          snapshot: {
            offerNumber: 'A-001',
            termMonths: 24,
            customerSnapshot: {
              companyName: 'Test GmbH',
              contactFirstName: 'Max',
              contactLastName: 'Mustermann',
            },
            totals: { oneTimeTotalCents: 10000, monthlyTotalCents: 5000 },
            tariffSnapshot: { name: 'Tarif A', providerName: 'Provider' },
            terminalLines: [],
            accessoryLines: [],
          },
        },
      },
      documents: [{ id: 'doc_1', data: { offerVersionId: 'ver_1', status: 'ready' } }],
    });

    const response = await routePublicOfferApi(
      new Request('https://example.test/api/public/offers/valid-token-123456789012345'),
      env(),
    );
    expect(response?.status).toBe(200);
    const payload = await response?.json();
    expect(payload.ok).toBe(true);
    expect(payload.view.offerNumber).toBe('A-001');
    expect(payload.view).not.toHaveProperty('internalNotes');
  });

  it('blockiert superseded Link ohne Angebotsdaten', async () => {
    buildClient({
      share: buildShareRow({ status: 'superseded', superseded_at: '2026-08-02T10:00:00.000Z' }),
    });
    const response = await routePublicOfferApi(
      new Request('https://example.test/api/public/offers/valid-token-123456789012345'),
      env(),
    );
    expect(response?.status).toBe(410);
    const payload = await response?.json();
    expect(payload.error).toBe('superseded');
    expect(payload.message).toContain('neuere Version');
  });

  it('schreibt first-access Activity nur einmal', async () => {
    const client = buildClient({
      share: buildShareRow({ access_count: 0 }),
      offer: {
        id: 'offer_1',
        lead_id: 'lead_1',
        data: { workflowStatus: 'ready_to_send', currentVersionId: 'ver_1' },
      },
      version: {
        id: 'ver_1',
        version_number: 1,
        created_at: '2026-08-02T10:00:00.000Z',
        data: {
          snapshot: {
            offerNumber: 'A-001',
            customerSnapshot: { companyName: 'Test GmbH' },
            totals: { oneTimeTotalCents: 0, monthlyTotalCents: 0 },
            terminalLines: [],
            accessoryLines: [],
          },
        },
      },
      existingActivity: null,
    });

    await routePublicOfferApi(
      new Request('https://example.test/api/public/offers/valid-token-123456789012345'),
      env(),
    );
    expect(client.insertActivity).toHaveBeenCalledTimes(1);
  });

  it('validiert Rückfrage-POST', async () => {
    buildClient({
      share: buildShareRow(),
    });
    const response = await routePublicOfferApi(
      new Request('https://example.test/api/public/offers/valid-token-123456789012345/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: '   ' }),
      }),
      env(),
    );
    expect(response?.status).toBe(400);
  });
});
