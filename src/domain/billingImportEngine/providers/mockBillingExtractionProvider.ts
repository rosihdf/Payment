import type {
  BillingDocumentExtractionProvider,
  BillingDocumentExtractionRequest,
  BillingDocumentExtractionResult,
  BillingExtractedPage,
} from './billingDocumentExtractionProvider';

/** Nur für Tests und explizit gekennzeichneten Demo-Modus – nicht für produktive Wahrheit. */
export class MockBillingExtractionProvider implements BillingDocumentExtractionProvider {
  readonly providerId = 'mock_billing_extraction';
  readonly providerVersion = 'test-1.0.0';
  readonly supportedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'];

  async extractDocument(
    request: BillingDocumentExtractionRequest,
  ): Promise<BillingDocumentExtractionResult> {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(request.content);

    const pages: BillingExtractedPage[] = [
      {
        pageNumber: 1,
        width: null,
        height: null,
        extractionMethod: 'embedded_text',
        text,
        textBlocks: text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ text: line, confidence: 0.95 })),
        averageConfidence: 0.95,
        rotationDegrees: 0,
      },
    ];

    return {
      ok: true,
      providerId: this.providerId,
      providerVersion: this.providerVersion,
      pages,
    };
  }
}
