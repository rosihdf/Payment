import { describe, expect, it, vi } from 'vitest';
import worker from '../../workers/amrtech-payment-downloads/src/index';

function createEnv(body = '{"versionName":"1.0.5","versionCode":10005}') {
  const bytes = new TextEncoder().encode(body);
  return {
    RELEASES: {
      get: vi.fn(async () => ({
        size: bytes.byteLength,
        httpEtag: '"etag"',
        writeHttpMetadata: (_headers: Headers) => undefined,
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      })),
    },
  };
}

describe('amrtech-payment-downloads CORS', () => {
  it('beantwortet OPTIONS mit CORS für Capacitor-Origin', async () => {
    const response = await worker.fetch(
      new Request('https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://localhost',
          'Access-Control-Request-Method': 'GET',
        },
      }),
      createEnv() as never,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toMatch(/GET/);
  });

  it('liefert latest.json mit CORS-Headern', async () => {
    const response = await worker.fetch(
      new Request('https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json', {
        method: 'GET',
        headers: { Origin: 'https://localhost', Accept: 'application/json' },
      }),
      createEnv() as never,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Content-Type')).toMatch(/application\/json/);
    const json = (await response.json()) as { versionCode: number };
    expect(json.versionCode).toBe(10005);
  });

  it('liefert 404 ebenfalls mit CORS', async () => {
    const env = {
      RELEASES: {
        get: vi.fn(async () => null),
      },
    };
    const response = await worker.fetch(
      new Request('https://amrtech-payment-downloads.amrtech.workers.dev/android/missing.json', {
        method: 'GET',
        headers: { Origin: 'https://localhost' },
      }),
      env as never,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
