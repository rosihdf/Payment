import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertSameOriginOcrAssetUrl,
  getBlockedOcrHosts,
  resolveBillingOcrAssetPaths,
  validateBillingOcrAssetPaths,
} from '../domain/billingImportEngine/billingOcrAssetPaths';
import {
  checkBillingOcrAssetsAvailable,
  resetBillingOcrAssetAvailabilityCache,
} from '../domain/billingImportEngine/billingOcrAssetAvailability';
import {
  LazyBrowserOcrExtractionProvider,
  __resetLazyBrowserOcrProviderForTests,
} from '../domain/billingImportEngine/providers/lazyBrowserOcrExtractionProvider';
import {
  isAbortError,
  normalizeAbortError,
  raceWithAbort,
  throwIfAborted,
} from '../utils/abort';

describe('A11.3 – Assetpfade', () => {
  it('löst Pfade relativ zur BASE_URL auf', () => {
    const paths = resolveBillingOcrAssetPaths('/');
    expect(paths.workerPath).toContain('/ocr/worker/worker.min.js');
    expect(paths.corePath).toContain('/ocr/core/');
    expect(paths.langPath).toContain('/ocr/lang/');
  });

  it('blockiert bekannte CDN-Hosts', () => {
    expect(() =>
      assertSameOriginOcrAssetUrl('https://cdn.jsdelivr.net/npm/tesseract.js/dist/worker.min.js'),
    ).toThrow(/BILLING_OCR_ASSET_ORIGIN_INVALID/);
  });

  it('validiert same-origin Pfade', () => {
    const paths = resolveBillingOcrAssetPaths('/');
    expect(() => validateBillingOcrAssetPaths(paths)).not.toThrow();
    expect(getBlockedOcrHosts()).toContain('cdn.jsdelivr.net');
  });
});

describe('A11.3 – Abort-Helfer', () => {
  it('erkennt DOMException AbortError', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
  });

  it('klassifiziert normale Fehler nicht als Abort', () => {
    expect(isAbortError(new Error('network failed'))).toBe(false);
  });

  it('bricht bei bereits abgebrochenem Signal ab', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrow(/aborted/i);
  });

  it('bricht laufende Promise bei Abort ab', async () => {
    const controller = new AbortController();
    const pending = new Promise<string>((resolve) => {
      setTimeout(() => resolve('done'), 50);
    });
    setTimeout(() => controller.abort(), 5);
    await expect(raceWithAbort(pending, controller.signal)).rejects.toSatisfy((error) =>
      isAbortError(error),
    );
  });

  it('normalisiert Abort-Fehler', () => {
    const normalized = normalizeAbortError(new DOMException('aborted', 'AbortError'));
    expect(normalized.message).toBe('BILLING_OCR_ABORTED');
  });
});

describe('A11.3 – Lazy OCR Provider', () => {
  beforeEach(() => {
    __resetLazyBrowserOcrProviderForTests();
    resetBillingOcrAssetAvailabilityCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('meldet Asset-Ausfall strukturiert', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const availability = await checkBillingOcrAssetsAvailable(true);
    expect(availability.status).toBe('unavailable');

    const provider = new LazyBrowserOcrExtractionProvider();
    const result = await provider.extractDocument({
      documentId: 'doc_1',
      fileName: 'scan.jpg',
      mimeType: 'image/jpeg',
      content: new Uint8Array([1]).buffer,
    });
    expect(result.errorCode).toBe('BILLING_OCR_ASSET_UNAVAILABLE');
  });

  it('behandelt Nutzerabbruch ohne Fehlerwurf', async () => {
    const provider = new LazyBrowserOcrExtractionProvider();
    const controller = new AbortController();
    controller.abort();
    const result = await provider.extractDocument({
      documentId: 'doc_1',
      fileName: 'scan.jpg',
      mimeType: 'image/jpeg',
      content: new Uint8Array([1]).buffer,
      signal: controller.signal,
    });
    expect(result.errorCode).toBe('BILLING_OCR_ABORTED');
  });
});
