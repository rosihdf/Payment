export interface BillingExtractedTextBlock {
  text: string;
  confidence: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number } | null;
}

export interface BillingExtractedPage {
  pageNumber: number;
  width: number | null;
  height: number | null;
  extractionMethod: 'embedded_text' | 'ocr' | 'mixed' | 'failed';
  text: string;
  textBlocks: BillingExtractedTextBlock[];
  averageConfidence: number;
  rotationDegrees: number;
  language?: string;
  durationMs?: number;
  preprocessingProfile?: string;
  warnings?: string[];
}

export interface BillingDocumentExtractionRequest {
  documentId: string;
  fileName: string;
  mimeType: string;
  content: ArrayBuffer;
  contentFingerprint?: string;
  rotationDegrees?: number;
  signal?: AbortSignal;
  onProgress?: (progress: import('../billingOcrConfig').BillingExtractionProgress) => void;
}

export interface BillingDocumentExtractionResult {
  ok: boolean;
  providerId: string;
  providerVersion: string;
  pages: BillingExtractedPage[];
  errorCode?: string;
  errorMessage?: string;
}

export interface BillingDocumentExtractionProvider {
  providerId: string;
  providerVersion: string;
  supportedMimeTypes: string[];
  extractDocument(request: BillingDocumentExtractionRequest): Promise<BillingDocumentExtractionResult>;
}
