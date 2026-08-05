import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recognize = vi.fn(async () => ({
  data: { text: 'ok', confidence: 90, blocks: [] },
}));
const terminate = vi.fn(async () => undefined);
const createWorker = vi.fn(async () => ({ recognize, terminate }));

vi.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => createWorker(...args),
}));

vi.mock('../domain/billingImportEngine/billingOcrAssetPaths', () => ({
  resolveBillingOcrAssetPaths: () => ({
    workerPath: '/ocr/worker/worker.min.js',
    corePath: '/ocr/core/',
    langPath: '/ocr/lang/',
  }),
  validateBillingOcrAssetPaths: () => undefined,
}));

describe('tesseractOcrEngine shared worker', () => {
  beforeEach(async () => {
    vi.resetModules();
    recognize.mockClear();
    terminate.mockClear();
    createWorker.mockClear();
    const { __resetTesseractOcrEngineForTests } = await import(
      '../domain/billingImportEngine/ocr/tesseractOcrEngine'
    );
    __resetTesseractOcrEngineForTests();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('teilt einen Worker zwischen Engine-Instanzen und beendet ihn erst beim letzten terminate', async () => {
    const { createTesseractOcrEngine } = await import(
      '../domain/billingImportEngine/ocr/tesseractOcrEngine'
    );

    const engineA = createTesseractOcrEngine();
    const engineB = createTesseractOcrEngine();
    await engineA.initialize();
    await engineB.initialize();

    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(engineA.isInitialized()).toBe(true);
    expect(engineB.isInitialized()).toBe(true);

    await engineA.terminate();
    expect(terminate).not.toHaveBeenCalled();
    expect(engineB.isInitialized()).toBe(true);

    await engineB.terminate();
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
