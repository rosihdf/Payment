import { BILLING_OCR_CONFIG } from './billingOcrConfig';

export type BillingConfidenceClass = 'high' | 'medium' | 'low' | 'unknown';

export function normalizeOcrConfidence(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= 1) {
    return Math.round(value * 100);
  }
  return Math.round(Math.min(100, Math.max(0, value)));
}

export function confidenceClassFromScore(score: number): BillingConfidenceClass {
  if (score >= BILLING_OCR_CONFIG.confidenceHighThreshold) {
    return 'high';
  }
  if (score >= BILLING_OCR_CONFIG.confidenceMediumThreshold) {
    return 'medium';
  }
  if (score > 0) {
    return 'low';
  }
  return 'unknown';
}
