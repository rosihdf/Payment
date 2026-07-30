import { BILLING_OCR_CONFIG, type BillingExtractionProgress } from '../billingOcrConfig';
import { confidenceClassFromScore, normalizeOcrConfidence } from '../billingOcrConfidence';
import { buildOcrCacheKey, getOcrCacheEntry, setOcrCacheEntry } from '../billingOcrCache';
import { billingOcrSessionManager } from '../billingOcrSessionManager';
import { preprocessCanvasForOcr, preprocessImageForOcr } from '../billingImagePreprocessing';
import { mapEngineProgressToExtractionProgress } from '../ocr/ocrEngine';
import type {
  BillingDocumentExtractionProvider,
  BillingDocumentExtractionRequest,
  BillingDocumentExtractionResult,
  BillingExtractedPage,
} from './billingDocumentExtractionProvider';
import { isAbortError } from '../../../utils/abort';
import { createTesseractOcrEngine } from '../ocr/tesseractOcrEngine';
import type { OcrEngineFactory } from '../ocr/ocrEngine';

function pageFromOcrResult(
  pageNumber: number,
  result: Awaited<ReturnType<import('../ocr/ocrEngine').OcrEngine['recognize']>>,
  rotationDegrees: number,
  width: number,
  height: number,
  preprocessingProfile: string,
): BillingExtractedPage {
  const confidence = normalizeOcrConfidence(result.meanConfidence) / 100;
  return {
    pageNumber,
    width,
    height,
    extractionMethod: 'ocr',
    text: result.text,
    textBlocks: result.words
      .filter((word) => word.text.trim().length > 0)
      .map((word) => ({
        text: word.text,
        confidence: normalizeOcrConfidence(word.confidence) / 100,
        bbox: word.bbox,
      })),
    averageConfidence: confidence,
    rotationDegrees,
    language: BILLING_OCR_CONFIG.languages,
    durationMs: result.durationMs,
    preprocessingProfile,
  };
}

export class BrowserOcrExtractionProvider implements BillingDocumentExtractionProvider {
  readonly providerId = BILLING_OCR_CONFIG.providerId;
  readonly providerVersion = BILLING_OCR_CONFIG.providerVersion;
  readonly supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  private readonly engineFactory: OcrEngineFactory;

  constructor(engineFactory: OcrEngineFactory = createTesseractOcrEngine) {
    this.engineFactory = engineFactory;
  }

  async extractDocument(
    request: BillingDocumentExtractionRequest,
  ): Promise<BillingDocumentExtractionResult> {
    const emit = (progress: BillingExtractionProgress) => {
      request.onProgress?.(progress);
    };

    if (request.signal?.aborted) {
      return this.error('BILLING_OCR_ABORTED', 'OCR wurde abgebrochen.');
    }

    try {
      emit({ phase: 'loading_worker', message: 'OCR-Worker wird vorbereitet…', documentId: request.documentId });

      const manager = new (await import('../billingOcrSessionManager')).BillingOcrSessionManager(
        this.engineFactory,
      );
      const engine = await manager.acquireEngine();

      try {
        await engine.initialize((engineProgress) => {
          emit(
            mapEngineProgressToExtractionProgress(engineProgress, {
              documentId: request.documentId,
            }),
          );
        });

        const blob = new Blob([request.content], { type: request.mimeType });
        const preprocessed = await preprocessImageForOcr(blob, {
          rotationDegrees: request.rotationDegrees ?? 0,
        });

        if (preprocessed.metadata.warnings.includes('BILLING_IMAGE_TOO_SMALL')) {
          return this.error(
            'BILLING_IMAGE_TOO_SMALL',
            'Das Bild ist zu klein für eine zuverlässige OCR-Erkennung.',
          );
        }

        const preprocessingProfile = 'grayscale_contrast_scale_v1';
        const cacheKey =
          request.contentFingerprint &&
          buildOcrCacheKey({
            contentFingerprint: request.contentFingerprint,
            pageNumber: 1,
            rotationDegrees: preprocessed.metadata.rotationDegrees,
            preprocessingProfile,
            providerVersion: this.providerVersion,
            language: BILLING_OCR_CONFIG.languages,
          });

        if (cacheKey) {
          const cached = getOcrCacheEntry(cacheKey);
          if (cached?.pages[0]) {
            emit({ phase: 'completed', message: 'OCR aus Cache geladen.', documentId: request.documentId, progress: 1 });
            return {
              ok: cached.pages[0].text.length > 0,
              providerId: this.providerId,
              providerVersion: this.providerVersion,
              pages: cached.pages,
              errorCode: cached.pages[0].text.length > 0 ? undefined : 'BILLING_OCR_NO_TEXT',
            };
          }
        }

        emit({
          phase: 'recognizing_page',
          message: 'Texterkennung läuft…',
          documentId: request.documentId,
          pageNumber: 1,
          totalPages: 1,
        });

        const ocrResult = await engine.recognize(preprocessed.canvas, {
          signal: request.signal,
        });

        const page = pageFromOcrResult(
          1,
          ocrResult,
          preprocessed.metadata.rotationDegrees,
          preprocessed.metadata.outputWidth,
          preprocessed.metadata.outputHeight,
          preprocessingProfile,
        );

        preprocessed.canvas.width = 0;
        preprocessed.canvas.height = 0;

        if (cacheKey) {
          setOcrCacheEntry(cacheKey, {
            pages: [page],
            providerId: this.providerId,
            providerVersion: this.providerVersion,
            language: BILLING_OCR_CONFIG.languages,
            preprocessingProfile,
          });
        }

        emit({ phase: 'completed', message: 'OCR abgeschlossen.', documentId: request.documentId, progress: 1 });

        if (!page.text.trim()) {
          return this.error('BILLING_OCR_NO_TEXT', 'Es wurde kein Text erkannt.', [page]);
        }

        if (page.averageConfidence < BILLING_OCR_CONFIG.confidenceMediumThreshold / 100) {
          page.warnings = ['BILLING_OCR_LOW_QUALITY'];
        }

        return {
          ok: true,
          providerId: this.providerId,
          providerVersion: this.providerVersion,
          pages: [page],
        };
      } finally {
        manager.releaseEngine();
      }
    } catch (error) {
      if (isAbortError(error)) {
        return this.error('BILLING_OCR_ABORTED', 'OCR wurde abgebrochen.');
      }
      const message = error instanceof Error ? error.message : 'OCR fehlgeschlagen';
      if (/timeout|aborted/i.test(message)) {
        return this.error('BILLING_OCR_TIMEOUT', 'OCR-Zeitüberschreitung.');
      }
      if (/worker|wasm|language/i.test(message)) {
        return this.error('BILLING_OCR_WORKER_LOAD_FAILED', message);
      }
      return this.error('BILLING_OCR_FAILED', message);
    }
  }

  private error(
    code: string,
    message: string,
    pages: BillingExtractedPage[] = [],
  ): BillingDocumentExtractionResult {
    return {
      ok: false,
      providerId: this.providerId,
      providerVersion: this.providerVersion,
      pages,
      errorCode: code,
      errorMessage: message,
    };
  }
}

export async function ocrPdfPageCanvas(
  canvas: HTMLCanvasElement,
  request: BillingDocumentExtractionRequest,
  pageNumber: number,
  totalPages: number,
  rotationDegrees: number,
  engineFactory?: OcrEngineFactory,
): Promise<BillingExtractedPage> {
  const manager = engineFactory
    ? new (await import('../billingOcrSessionManager')).BillingOcrSessionManager(engineFactory)
    : billingOcrSessionManager;
  const engine = await manager.acquireEngine();
  const preprocessingProfile = 'grayscale_contrast_scale_v1';

  try {
    if (!engine.isInitialized()) {
      await engine.initialize((engineProgress) => {
        request.onProgress?.(
          mapEngineProgressToExtractionProgress(engineProgress, {
            documentId: request.documentId,
            pageNumber,
            totalPages,
          }),
        );
      });
    }

    const preprocessed = await preprocessCanvasForOcr(canvas, { rotationDegrees });
    request.onProgress?.({
      phase: 'recognizing_page',
      message: `Seite ${pageNumber} von ${totalPages} wird erkannt…`,
      documentId: request.documentId,
      pageNumber,
      totalPages,
    });

    const cacheKey =
      request.contentFingerprint &&
      buildOcrCacheKey({
        contentFingerprint: request.contentFingerprint,
        pageNumber,
        rotationDegrees: preprocessed.metadata.rotationDegrees,
        preprocessingProfile,
        providerVersion: BILLING_OCR_CONFIG.providerVersion,
        language: BILLING_OCR_CONFIG.languages,
      });

    if (cacheKey) {
      const cached = getOcrCacheEntry(cacheKey);
      if (cached?.pages[0]) {
        return cached.pages[0];
      }
    }

    const ocrResult = await engine.recognize(preprocessed.canvas, { signal: request.signal });
    const page = pageFromOcrResult(
      pageNumber,
      ocrResult,
      preprocessed.metadata.rotationDegrees,
      preprocessed.metadata.outputWidth,
      preprocessed.metadata.outputHeight,
      preprocessingProfile,
    );

    if (cacheKey) {
      setOcrCacheEntry(cacheKey, {
        pages: [page],
        providerId: BILLING_OCR_CONFIG.providerId,
        providerVersion: BILLING_OCR_CONFIG.providerVersion,
        language: BILLING_OCR_CONFIG.languages,
        preprocessingProfile,
      });
    }

    preprocessed.canvas.width = 0;
    preprocessed.canvas.height = 0;
    return page;
  } finally {
    manager.releaseEngine();
  }
}

export function getOcrConfidenceClass(score: number): ReturnType<typeof confidenceClassFromScore> {
  return confidenceClassFromScore(normalizeOcrConfidence(score));
}
