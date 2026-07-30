import { BILLING_OCR_CONFIG } from './billingOcrConfig';
import type { BillingExtractedPage } from './providers/billingDocumentExtractionProvider';

export interface BillingOcrCacheEntry {
  pages: BillingExtractedPage[];
  providerId: string;
  providerVersion: string;
  language: string;
  preprocessingProfile: string;
}

const cache = new Map<string, BillingOcrCacheEntry>();

export function buildOcrCacheKey(input: {
  contentFingerprint: string;
  pageNumber: number;
  rotationDegrees: number;
  preprocessingProfile: string;
  providerVersion: string;
  language: string;
}): string {
  return [
    input.contentFingerprint,
    input.pageNumber,
    input.rotationDegrees,
    input.preprocessingProfile,
    input.providerVersion,
    input.language,
  ].join(':');
}

export function getOcrCacheEntry(key: string): BillingOcrCacheEntry | null {
  return cache.get(key) ?? null;
}

export function setOcrCacheEntry(key: string, entry: BillingOcrCacheEntry): void {
  if (cache.size >= BILLING_OCR_CONFIG.maxCacheEntries) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.delete(oldest);
    }
  }
  cache.set(key, entry);
}

export function clearOcrCache(): void {
  cache.clear();
}

export function invalidateOcrCacheForFingerprint(contentFingerprint: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${contentFingerprint}:`)) {
      cache.delete(key);
    }
  }
}

export function __getOcrCacheSizeForTests(): number {
  return cache.size;
}
