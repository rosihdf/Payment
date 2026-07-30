export type BillingDocumentType =
  | 'invoice'
  | 'credit_note'
  | 'correction'
  | 'collective'
  | 'annual'
  | 'unknown';

export type BillingExtractionStatus =
  | 'pending'
  | 'preparing'
  | 'extracting_text'
  | 'running_ocr'
  | 'recognizing_fields'
  | 'review_required'
  | 'confirmed'
  | 'failed';

export interface BillingSourceDocument {
  id: string;
  sessionId: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number;
  contentFingerprint: string;
  uploadOrder: number;
  extractionStatus: BillingExtractionStatus;
  documentType: BillingDocumentType;
  detectedProviderName: string | null;
  detectedCustomerNumber: string | null;
  detectedInvoiceNumber: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  currency: string | null;
  netGrossBasis: 'net' | 'gross' | 'unknown';
  averageConfidence: number | null;
  duplicateStatus: 'none' | 'exact_duplicate' | 'possible_duplicate';
  duplicateOfDocumentId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
