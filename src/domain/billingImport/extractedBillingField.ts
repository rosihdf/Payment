import type { BillingFieldCategory, BillingFieldCode } from './billingFieldCodes';

export type BillingConfidenceClass = 'high' | 'medium' | 'low' | 'unknown';

export type ExtractedFieldStatus =
  | 'detected'
  | 'review_required'
  | 'confirmed'
  | 'corrected'
  | 'rejected'
  | 'manually_added';

export interface ExtractedBillingField {
  id: string;
  documentId: string;
  pageNumber: number | null;
  fieldCode: BillingFieldCode;
  fieldCategory: BillingFieldCategory;
  originalText: string;
  rawValue: string;
  normalizedValue: string | number | null;
  unit: string | null;
  currency: string | null;
  confidence: number | null;
  confidenceClass: BillingConfidenceClass;
  detectionMethod: 'embedded_text' | 'ocr' | 'manual' | 'mock';
  sourceLine: string | null;
  status: ExtractedFieldStatus;
  originalDetectedValue: string | number | null;
  correctedValue: string | number | null;
  correctedByUserId: string | null;
  correctedAt: string | null;
  comment: string;
  candidateGroupId: string | null;
}
