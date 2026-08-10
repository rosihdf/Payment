import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkBillingOcrAssetsAvailable,
  resetBillingOcrAssetAvailabilityCache,
} from '../domain/billingImportEngine/billingOcrAssetAvailability';

describe('billingOcrAssetAvailability O1', () => {
  beforeEach(() => {
    resetBillingOcrAssetAvailabilityCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verlangt Worker, beide Core-JS-Varianten und alle Sprachen', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      expect(method).toBe('HEAD');
      const ok =
        url.includes('/ocr/worker/worker.min.js') ||
        url.endsWith('/tesseract-core-lstm.wasm.js') ||
        url.endsWith('/tesseract-core-simd-lstm.wasm.js') ||
        url.endsWith('/deu.traineddata');
      return new Response(null, { status: ok ? 200 : 404 });
    });

    const availability = await checkBillingOcrAssetsAvailable(true);
    expect(availability.status).toBe('available');
    expect(availability.worker).toBe(true);
    expect(availability.core).toBe(true);
    expect(availability.coreSimd).toBe(true);
    expect(availability.languages).toEqual({ deu: true });
  });

  it('meldet partial, wenn SIMD-Core-JS fehlt', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const ok =
        url.includes('/ocr/worker/worker.min.js') ||
        url.endsWith('/tesseract-core-lstm.wasm.js') ||
        url.endsWith('/deu.traineddata');
      return new Response(null, { status: ok ? 200 : 404 });
    });

    const availability = await checkBillingOcrAssetsAvailable(true);
    expect(availability.status).toBe('partially_available');
    expect(availability.core).toBe(true);
    expect(availability.coreSimd).toBe(false);
  });
});
