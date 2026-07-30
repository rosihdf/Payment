import type {
  BillingDocumentExtractionProvider,
  BillingDocumentExtractionRequest,
  BillingDocumentExtractionResult,
} from './billingDocumentExtractionProvider';

export class UnavailableOcrExtractionProvider implements BillingDocumentExtractionProvider {
  readonly providerId = 'unavailable_ocr';
  readonly providerVersion = '1.0.0';
  readonly supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  async extractDocument(
    _request: BillingDocumentExtractionRequest,
  ): Promise<BillingDocumentExtractionResult> {
    return {
      ok: false,
      providerId: this.providerId,
      providerVersion: this.providerVersion,
      pages: [],
      errorCode: 'BILLING_OCR_UNAVAILABLE',
      errorMessage:
        'OCR für Bilddateien ist produktiv nicht verfügbar. Bitte Werte manuell erfassen oder ein maschinenlesbares PDF hochladen.',
    };
  }
}
