/** Minimale R2-Typen – Worker wird auch von App-Tests importiert (ohne @cloudflare/workers-types). */
interface R2ObjectBody {
  size: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}

interface Env {
  RELEASES: R2Bucket;
}

const ALLOWED_PATHS = new Set([
  '/android/latest.apk',
  '/android/latest.json',
  '/android/v1.0.0/AMRtech-Payment-1.0.0.apk',
  '/android/v1.0.0/AMRtech-Payment-1.0.0.apk.sha256',
  '/android/v1.0.1/AMRtech-Payment-1.0.1.apk',
  '/android/v1.0.1/AMRtech-Payment-1.0.1.apk.sha256',
  '/android/v1.0.1/manifest.json',
  '/android/v1.0.2/AMRtech-Payment-1.0.2.apk',
  '/android/v1.0.2/AMRtech-Payment-1.0.2.apk.sha256',
  '/android/v1.0.2/manifest.json',
  '/android/v1.0.3/AMRtech-Payment-1.0.3.apk',
  '/android/v1.0.3/AMRtech-Payment-1.0.3.apk.sha256',
  '/android/v1.0.3/manifest.json',
  '/android/v1.0.4/AMRtech-Payment-1.0.4.apk',
  '/android/v1.0.4/AMRtech-Payment-1.0.4.apk.sha256',
  '/android/v1.0.4/manifest.json',
  '/android/v1.0.5/AMRtech-Payment-1.0.5.apk',
  '/android/v1.0.5/AMRtech-Payment-1.0.5.apk.sha256',
  '/android/v1.0.5/manifest.json',
  '/android/v1.0.6/AMRtech-Payment-1.0.6.apk',
  '/android/v1.0.6/AMRtech-Payment-1.0.6.apk.sha256',
  '/android/v1.0.6/manifest.json',
  '/android/v1.0.7/AMRtech-Payment-1.0.7.apk',
  '/android/v1.0.7/AMRtech-Payment-1.0.7.apk.sha256',
  '/android/v1.0.7/manifest.json',
  '/android/v1.0.8/AMRtech-Payment-1.0.8.apk',
  '/android/v1.0.8/AMRtech-Payment-1.0.8.apk.sha256',
  '/android/v1.0.8/manifest.json',
  '/android/v1.0.9/AMRtech-Payment-1.0.9.apk',
  '/android/v1.0.9/AMRtech-Payment-1.0.9.apk.sha256',
  '/android/v1.0.9/manifest.json',
  '/android/v1.0.10/AMRtech-Payment-1.0.10.apk',
  '/android/v1.0.10/AMRtech-Payment-1.0.10.apk.sha256',
  '/android/v1.0.10/manifest.json',
  '/android/v1.0.11/AMRtech-Payment-1.0.11.apk',
  '/android/v1.0.11/AMRtech-Payment-1.0.11.apk.sha256',
  '/android/v1.0.11/manifest.json',
  '/android/v1.0.12/AMRtech-Payment-1.0.12.apk',
  '/android/v1.0.12/AMRtech-Payment-1.0.12.apk.sha256',
  '/android/v1.0.12/manifest.json',
  '/android/latest-test.json',
  '/android/latest-test.apk',
  '/android/play-protect-test/ppA/AMRtech-Payment-ppA.apk',
  '/android/play-protect-test/ppA/AMRtech-Payment-ppA.apk.sha256',
]);

/** Öffentliche Release-Dateien; Capacitor Android nutzt https://localhost als Origin. */
function applyCors(headers: Headers): Headers {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function contentTypeFor(path: string): string {
  if (path.endsWith('.apk')) {
    return 'application/vnd.android.package-archive';
  }
  if (path.endsWith('.json')) {
    return 'application/json; charset=utf-8';
  }
  if (path.endsWith('.sha256')) {
    return 'text/plain; charset=utf-8';
  }
  return 'application/octet-stream';
}

function cacheControlFor(path: string): string {
  if (path.includes('/latest.') || path.includes('/latest-test.')) {
    return 'public, max-age=300, must-revalidate';
  }
  return 'public, max-age=31536000, immutable';
}

function filenameFor(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || 'download';
}

function textResponse(body: string, status: number, extra: HeadersInit = {}): Response {
  const headers = applyCors(new Headers(extra));
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(body, { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: applyCors(new Headers()),
        });
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return textResponse('Method Not Allowed', 405, { Allow: 'GET, HEAD, OPTIONS' });
      }

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (!ALLOWED_PATHS.has(path)) {
        return textResponse('Not Found', 404);
      }

      const objectKey = path.replace(/^\//, '');
      const object = await env.RELEASES.get(objectKey);
      if (!object) {
        return textResponse('Not Found', 404);
      }

      const headers = applyCors(new Headers());
      object.writeHttpMetadata(headers);
      headers.set('Content-Type', contentTypeFor(path));
      headers.set('Content-Disposition', `attachment; filename="${filenameFor(path)}"`);
      headers.set('Cache-Control', cacheControlFor(path));
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('ETag', object.httpEtag);

      if (request.method === 'HEAD') {
        headers.set('Content-Length', String(object.size));
        return new Response(null, { status: 200, headers });
      }

      const body = await object.arrayBuffer();
      headers.set('Content-Length', String(body.byteLength));
      return new Response(body, { status: 200, headers });
    } catch {
      return textResponse('Bad Gateway', 502);
    }
  },
};
