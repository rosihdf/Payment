import { BILLING_OCR_CONFIG, type BillingExtractionProgress } from '../billingOcrConfig';
import type {
  BillingDocumentExtractionProvider,
  BillingDocumentExtractionRequest,
  BillingDocumentExtractionResult,
} from './billingDocumentExtractionProvider';
import { isAbortError, normalizeAbortError } from '../../../utils/abort';

type LoadedOcrProvider = BillingDocumentExtractionProvider & {
  ocrPdfPageCanvas?: typeof import('./browserOcrExtractionProvider').ocrPdfPageCanvas;
};

let providerPromise: Promise<LoadedOcrProvider> | null = null;
let loadedProvider: LoadedOcrProvider | null = null;

async function loadProvider(onProgress?: (progress: BillingExtractionProgress) => void): Promise<LoadedOcrProvider> {
  if (loadedProvider) {
    return loadedProvider;
  }
  if (!providerPromise) {
    providerPromise = (async () => {
      onProgress?.({ phase: 'loading_worker', message: 'OCR-Modul wird geladen…' });
      const [{ checkBillingOcrAssetsAvailable }, module] = await Promise.all([
        import('../billingOcrAssetAvailability'),
        import('./browserOcrExtractionProvider'),
      ]);
      const availability = await checkBillingOcrAssetsAvailable();
      if (availability.status === 'unavailable') {
        throw new Error('BILLING_OCR_ASSET_UNAVAILABLE');
      }
      loadedProvider = new module.BrowserOcrExtractionProvider() as LoadedOcrProvider;
      loadedProvider.ocrPdfPageCanvas = module.ocrPdfPageCanvas;
      return loadedProvider;
    })().catch((error) => {
      providerPromise = null;
      throw error;
    });
  }
  return providerPromise;
}

export class LazyBrowserOcrExtractionProvider implements BillingDocumentExtractionProvider {
  readonly providerId = BILLING_OCR_CONFIG.providerId;
  readonly providerVersion = BILLING_OCR_CONFIG.providerVersion;
  readonly supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  async extractDocument(
    request: BillingDocumentExtractionRequest,
  ): Promise<BillingDocumentExtractionResult> {
    if (request.signal?.aborted) {
      return this.cancelledResult();
    }

    try {
      request.onProgress?.({
        phase: 'loading_worker',
        message: 'Lokale OCR-Komponenten werden vorbereitet…',
        documentId: request.documentId,
      });
      const provider = await loadProvider(request.onProgress);
      return provider.extractDocument(request);
    } catch (error) {
      if (isAbortError(error)) {
        return this.cancelledResult();
      }
      const normalized = normalizeAbortError(error);
      if (normalized.message.includes('BILLING_OCR_ASSET')) {
        return {
          ok: false,
          providerId: this.providerId,
          providerVersion: this.providerVersion,
          pages: [],
          errorCode: 'BILLING_OCR_ASSET_UNAVAILABLE',
          errorMessage:
            'Lokale OCR-Assets sind nicht verfügbar. Bitte Seite neu laden oder Werte manuell erfassen.',
        };
      }
      return {
        ok: false,
        providerId: this.providerId,
        providerVersion: this.providerVersion,
        pages: [],
        errorCode: 'BILLING_OCR_WORKER_LOAD_FAILED',
        errorMessage: normalized.message,
      };
    }
  }

  private cancelledResult(): BillingDocumentExtractionResult {
    return {
      ok: false,
      providerId: this.providerId,
      providerVersion: this.providerVersion,
      pages: [],
      errorCode: 'BILLING_OCR_ABORTED',
      errorMessage: 'OCR wurde abgebrochen.',
    };
  }
}

export async function loadLazyOcrProviderModule(): Promise<typeof import('./browserOcrExtractionProvider')> {
  await loadProvider();
  return import('./browserOcrExtractionProvider');
}

export function __resetLazyBrowserOcrProviderForTests(): void {
  providerPromise = null;
  loadedProvider = null;
}
