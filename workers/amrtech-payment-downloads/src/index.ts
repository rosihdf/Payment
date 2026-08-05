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
]);

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
  if (path.includes('/latest.')) {
    return 'public, max-age=300, must-revalidate';
  }
  return 'public, max-age=31536000, immutable';
}

function filenameFor(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || 'download';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: {
            Allow: 'GET, HEAD',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (!ALLOWED_PATHS.has(path)) {
        return new Response('Not Found', {
          status: 404,
          headers: { 'X-Content-Type-Options': 'nosniff' },
        });
      }

      const objectKey = path.replace(/^\//, '');
      const object = await env.RELEASES.get(objectKey);
      if (!object) {
        return new Response('Not Found', {
          status: 404,
          headers: { 'X-Content-Type-Options': 'nosniff' },
        });
      }

      const headers = new Headers();
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
      return new Response('Bad Gateway', {
        status: 502,
        headers: { 'X-Content-Type-Options': 'nosniff' },
      });
    }
  },
};
