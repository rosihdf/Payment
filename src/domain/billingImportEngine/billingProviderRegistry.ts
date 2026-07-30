import type { BillingDocumentExtractionProvider } from './providers/billingDocumentExtractionProvider';

export interface BillingProviderRegistry {
  getPdfTextProvider: () => Promise<BillingDocumentExtractionProvider>;
  getOcrProvider: () => Promise<BillingDocumentExtractionProvider>;
  fallbackOcrProvider: BillingDocumentExtractionProvider;
  demoProvider: BillingDocumentExtractionProvider | null;
  useDemoProvider: boolean;
}
