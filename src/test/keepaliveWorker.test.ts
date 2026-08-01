import { afterEach, describe, expect, it, vi } from 'vitest';
import { touchSystemKeepalive, type Env } from '../../workers/amrtech-payment/src/index';

describe('cloudflare keepalive worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls touch_system_keepalive rpc on the final supabase project', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, last_seen_at: '2026-08-01T00:00:00.000Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const env: Env = {
      SUPABASE_URL: 'https://vohnqrftkuefkugabcob.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      KEEPALIVE_TOKEN: 'secret-token',
      ASSETS: { fetch: vi.fn() },
    };

    const response = await touchSystemKeepalive(env);
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://vohnqrftkuefkugabcob.supabase.co/rest/v1/rpc/touch_system_keepalive',
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ p_token: 'secret-token' });
  });

  it('surfaces upstream keepalive failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('boom', { status: 500 })),
    );

    const env: Env = {
      SUPABASE_URL: 'https://vohnqrftkuefkugabcob.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      ASSETS: { fetch: vi.fn() },
    };

    const response = await touchSystemKeepalive(env);
    expect(response.status).toBe(502);
    const payload = (await response.json()) as { ok: boolean };
    expect(payload.ok).toBe(false);
  });
});
