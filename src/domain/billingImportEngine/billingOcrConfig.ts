export const BILLING_OCR_CONFIG = {
  providerId: 'browser_tesseract_ocr',
  providerVersion: '1.0.0',
  languages: 'deu+eng',
  pdfRenderScale: 2,
  maxPdfRenderScale: 2.5,
  minPdfRenderScale: 1.5,
  maxImageDimensionPx: 2400,
  minImageDimensionPx: 200,
  ocrTimeoutMs: 120_000,
  maxConcurrentOcrJobs: 1,
  maxCacheEntries: 48,
  confidenceHighThreshold: 85,
  confidenceMediumThreshold: 60,
  pdfMinTextLength: 40,
  pdfMinReadableCharRatio: 0.55,
  pdfMinKeywordHits: 1,
  billingKeywords: [
    'rechnung',
    'abrechnung',
    'umsatz',
    'transaktion',
    'gebühr',
    'terminal',
    'kunde',
    'netto',
    'brutto',
    'invoice',
    'fee',
    'amount',
  ],
} as const;

export type BillingOcrProgressPhase =
  | 'loading_worker'
  | 'loading_language'
  | 'initializing'
  | 'rendering_page'
  | 'recognizing_page'
  | 'detecting_fields'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface BillingExtractionProgress {
  phase: BillingOcrProgressPhase;
  documentId?: string;
  pageNumber?: number;
  totalPages?: number;
  progress?: number;
  message: string;
}
