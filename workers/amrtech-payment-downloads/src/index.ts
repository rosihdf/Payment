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
  '/android/v1.0.13/AMRtech-Payment-1.0.13.apk',
  '/android/v1.0.13/AMRtech-Payment-1.0.13.apk.sha256',
  '/android/v1.0.13/manifest.json',
  '/android/v1.0.14/AMRtech-Payment-1.0.14.apk',
  '/android/v1.0.14/AMRtech-Payment-1.0.14.apk.sha256',
  '/android/v1.0.14/manifest.json',
  '/android/v1.0.15/AMRtech-Payment-1.0.15.apk',
  '/android/v1.0.15/AMRtech-Payment-1.0.15.apk.sha256',
  '/android/v1.0.15/manifest.json',
  '/android/v1.0.16/AMRtech-Payment-1.0.16.apk',
  '/android/v1.0.16/AMRtech-Payment-1.0.16.apk.sha256',
  '/android/v1.0.16/manifest.json',
  '/android/v1.0.17/AMRtech-Payment-1.0.17.apk',
  '/android/v1.0.17/AMRtech-Payment-1.0.17.apk.sha256',
  '/android/v1.0.17/manifest.json',
  '/android/v1.0.18/AMRtech-Payment-1.0.18.apk',
  '/android/v1.0.18/AMRtech-Payment-1.0.18.apk.sha256',
  '/android/v1.0.18/manifest.json',
  '/android/v1.0.19/AMRtech-Payment-1.0.19.apk',
  '/android/v1.0.19/AMRtech-Payment-1.0.19.apk.sha256',
  '/android/v1.0.19/manifest.json',
  '/android/v1.0.20/AMRtech-Payment-1.0.20.apk',
  '/android/v1.0.20/AMRtech-Payment-1.0.20.apk.sha256',
  '/android/v1.0.20/manifest.json',
  '/android/v1.0.21/AMRtech-Payment-1.0.21.apk',
  '/android/v1.0.21/AMRtech-Payment-1.0.21.apk.sha256',
  '/android/v1.0.21/manifest.json',
  '/android/v1.0.22/AMRtech-Payment-1.0.22.apk',
  '/android/v1.0.22/AMRtech-Payment-1.0.22.apk.sha256',
  '/android/v1.0.22/manifest.json',
  '/android/v1.0.23/AMRtech-Payment-1.0.23.apk',
  '/android/v1.0.23/AMRtech-Payment-1.0.23.apk.sha256',
  '/android/v1.0.23/manifest.json',
  '/android/v1.0.24/AMRtech-Payment-1.0.24.apk',
  '/android/v1.0.24/AMRtech-Payment-1.0.24.apk.sha256',
  '/android/v1.0.24/manifest.json',
  '/android/v1.0.25/AMRtech-Payment-1.0.25.apk',
  '/android/v1.0.25/AMRtech-Payment-1.0.25.apk.sha256',
  '/android/v1.0.25/manifest.json',
  '/android/v1.0.26/AMRtech-Payment-1.0.26.apk',
  '/android/v1.0.26/AMRtech-Payment-1.0.26.apk.sha256',
  '/android/v1.0.26/manifest.json',
  '/android/v1.0.27/AMRtech-Payment-1.0.27.apk',
  '/android/v1.0.27/AMRtech-Payment-1.0.27.apk.sha256',
  '/android/v1.0.27/manifest.json',
  '/android/latest-test.json',
  '/android/latest-test.apk',
  '/android/play-protect-test/ppA/AMRtech-Payment-ppA.apk',
  '/android/play-protect-test/ppA/AMRtech-Payment-ppA.apk.sha256',
  '/android/play-protect-test/minimal-payment-installer/AMRtech-Payment-pp-min.apk',
  '/android/play-protect-test/minimal-payment-installer/AMRtech-Payment-pp-min.apk.sha256',
  '/android/play-protect-test/payment-package-with-maintenance-cert/AMRtech-Payment-pp-cert.apk',
  '/android/play-protect-test/payment-package-with-maintenance-cert/AMRtech-Payment-pp-cert.apk.sha256',
  '/android/play-protect-test/new-package-id/AMRtech-Payment-pp-package.apk',
  '/android/play-protect-test/new-package-id/AMRtech-Payment-pp-package.apk.sha256',
  '/android/play-protect-test/installer-permission-source/AMRtech-Payment-installer-test.apk',
  '/android/play-protect-test/installer-permission-source/AMRtech-Payment-installer-test.apk.sha256',
  '/android/play-protect-test/installer-permission-target/AMRtech-Payment-target.apk',
  '/android/play-protect-test/installer-permission-target/AMRtech-Payment-target.apk.sha256',
  '/android/play-protect-test/installer-permission-flow/latest.json',
  '/android/play-protect-test/minsdk24/AMRtech-Payment-pp-min24.apk',
  '/android/play-protect-test/minsdk24/AMRtech-Payment-pp-min24.apk.sha256',
  '/android/baseline-test/phase5b/AMRtech-Payment-phase5b-no-updater.apk',
  '/android/baseline-test/phase5b/AMRtech-Payment-phase5b-no-updater.apk.sha256',
  '/android/updater-test/phase6a/AMRtech-Payment-updater-test.apk',
  '/android/updater-test/phase6a/AMRtech-Payment-updater-test.apk.sha256',
  '/android/updater-test/phase6b/AMRtech-Payment-browser-update-test.apk',
  '/android/updater-test/phase6b/AMRtech-Payment-browser-update-test.apk.sha256',
  '/android/e2e-browser-update/latest.json',
  '/android/e2e-browser-update/v19110/AMRtech-Payment-e2e-a.apk',
  '/android/e2e-browser-update/v19110/AMRtech-Payment-e2e-a.apk.sha256',
  '/android/e2e-browser-update/v19111/AMRtech-Payment-e2e-b.apk',
  '/android/e2e-browser-update/v19111/AMRtech-Payment-e2e-b.apk.sha256',
  '/android/e2e-browser-update/v19112/AMRtech-Payment-e2e-c.apk',
  '/android/e2e-browser-update/v19112/AMRtech-Payment-e2e-c.apk.sha256',
  '/android/e2e-browser-update/v10044/AMRtech-Payment-1.0.28.apk',
  '/android/e2e-browser-update/v10044/AMRtech-Payment-1.0.28.apk.sha256',
  '/android/e2e-browser-update/v10045/AMRtech-Payment-1.0.29.apk',
  '/android/e2e-browser-update/v10045/AMRtech-Payment-1.0.29.apk.sha256',
  '/android/play-protect-test/phase6d-golden-p1/AMRtech-Payment-1.0.28.apk',
  '/android/play-protect-test/phase6d-golden-p1/AMRtech-Payment-1.0.28.apk.sha256',
  '/android/play-protect-test/phase6e-signing-ab/AMRtech-Payment-1.0.28-wartung-cert.apk',
  '/android/play-protect-test/phase6e-signing-ab/AMRtech-Payment-1.0.28-wartung-cert.apk.sha256',
  '/android/play-protect-test/phase6f-g1/AMRtech-Payment-bisect-g1.apk',
  '/android/play-protect-test/phase6f-g1/AMRtech-Payment-bisect-g1.apk.sha256',
  '/android/play-protect-test/phase6h-h2/AMRtech-Payment-h2.apk',
  '/android/play-protect-test/phase6h-h2/AMRtech-Payment-h2.apk.sha256',
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
