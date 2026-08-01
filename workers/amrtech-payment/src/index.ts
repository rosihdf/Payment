import { routeAdminUsersApi, type AdminEnv } from './adminUsersApi';

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env extends AdminEnv {
  KEEPALIVE_TOKEN?: string;
  ASSETS: AssetFetcher;
}

export async function touchSystemKeepalive(env: Env): Promise<Response> {
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/touch_system_keepalive`;
  const body = {
    p_token: env.KEEPALIVE_TOKEN ?? null,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    return new Response(
      JSON.stringify({ ok: false, status: response.status, body: text }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(text || JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleAssetRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const assetResponse = await env.ASSETS.fetch(request);

  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  if (url.pathname.includes('.') && !url.pathname.endsWith('.html')) {
    return assetResponse;
  }

  const indexRequest = new Request(new URL('/index.html', url.origin), request);
  return env.ASSETS.fetch(indexRequest);
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/__keepalive' && request.method === 'POST') {
      return touchSystemKeepalive(env);
    }

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': url.origin,
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const adminResponse = await routeAdminUsersApi(request, env);
    if (adminResponse) {
      return adminResponse;
    }

    return handleAssetRequest(request, env);
  },

  async scheduled(_controller: unknown, env: Env): Promise<void> {
    const result = await touchSystemKeepalive(env);
    if (!result.ok) {
      const body = await result.text();
      console.error('keepalive failed', result.status, body);
    }
  },
};

export default worker;
