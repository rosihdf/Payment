import type { OcrEngine, OcrEngineFactory } from './ocrEngine';
import { resolveBillingOcrAssetPaths, validateBillingOcrAssetPaths } from '../billingOcrAssetPaths';
import { BILLING_OCR_CONFIG } from '../billingOcrConfig';
import { normalizeOcrConfidence } from '../billingOcrConfidence';
import { isAbortError, raceWithAbort, throwIfAborted } from '../../../utils/abort';

let sharedInitPromise: Promise<void> | null = null;

async function loadTesseractModule() {
  return import('tesseract.js');
}

export function createTesseractOcrEngine(): OcrEngine {
  let worker: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadTesseractModule>>['createWorker']>
  > | null = null;
  let initialized = false;
  let disposed = false;

  return {
    isInitialized() {
      return initialized;
    },

    async initialize(onProgress) {
      if (disposed) {
        throw new Error('BILLING_OCR_PROVIDER_DISPOSED');
      }
      if (initialized && worker) {
        return;
      }
      if (!sharedInitPromise) {
        sharedInitPromise = (async () => {
          const paths = resolveBillingOcrAssetPaths();
          validateBillingOcrAssetPaths(paths);
          const { createWorker } = await loadTesseractModule();
          worker = await createWorker(BILLING_OCR_CONFIG.languages, 1, {
            workerPath: paths.workerPath,
            corePath: paths.corePath,
            langPath: paths.langPath,
            workerBlobURL: false,
            logger: (message) => {
              if (message.status) {
                onProgress?.({
                  status: message.status,
                  progress: typeof message.progress === 'number' ? message.progress : 0,
                });
              }
            },
          });
          initialized = true;
        })().catch((error) => {
          sharedInitPromise = null;
          worker = null;
          initialized = false;
          throw error;
        });
      }
      await sharedInitPromise;
    },

    async recognize(image, options) {
      if (disposed) {
        throw new Error('BILLING_OCR_PROVIDER_DISPOSED');
      }
      if (!worker || !initialized) {
        throw new Error('BILLING_OCR_UNAVAILABLE');
      }

      throwIfAborted(options?.signal);
      const started = performance.now();
      const timeout = options?.timeoutMs ?? BILLING_OCR_CONFIG.ocrTimeoutMs;
      let timeoutId: number | undefined;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error('BILLING_OCR_TIMEOUT'));
        }, timeout);
      });

      try {
        const result = await raceWithAbort(
          Promise.race([
            worker.recognize(image, {}, { blocks: true, text: true }),
            timeoutPromise,
          ]),
          options?.signal,
        );

        const words: Array<{
          text: string;
          confidence: number;
          bbox: { x0: number; y0: number; x1: number; y1: number } | null;
        }> = [];

        for (const block of result.data.blocks ?? []) {
          for (const paragraph of block.paragraphs ?? []) {
            for (const line of paragraph.lines ?? []) {
              for (const word of line.words ?? []) {
                if (!word.text.trim()) {
                  continue;
                }
                words.push({
                  text: word.text,
                  confidence: normalizeOcrConfidence(word.confidence),
                  bbox: word.bbox
                    ? { x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 }
                    : null,
                });
              }
            }
          }
        }

        const meanConfidence =
          words.length > 0
            ? Math.round(words.reduce((sum, word) => sum + word.confidence, 0) / words.length)
            : normalizeOcrConfidence(result.data.confidence);

        return {
          text: result.data.text.replace(/\s+/g, ' ').trim(),
          words,
          meanConfidence,
          durationMs: Math.round(performance.now() - started),
        };
      } catch (error) {
        if (isAbortError(error) || (error instanceof Error && /BILLING_OCR_TIMEOUT/.test(error.message))) {
          throw error instanceof Error ? error : new Error('BILLING_OCR_ABORTED');
        }
        throw error;
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      }
    },

    async terminate() {
      disposed = true;
      sharedInitPromise = null;
      if (worker) {
        await worker.terminate();
        worker = null;
        initialized = false;
      }
    },
  };
}

export function __resetTesseractOcrEngineForTests(): void {
  sharedInitPromise = null;
}

export type { OcrEngineFactory };
