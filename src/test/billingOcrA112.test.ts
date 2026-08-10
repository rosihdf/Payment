import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assessEmbeddedTextQuality } from '../domain/billingImportEngine/billingPdfTextQuality';
import {
  buildOcrCacheKey,
  clearOcrCache,
  getOcrCacheEntry,
  invalidateOcrCacheForFingerprint,
  setOcrCacheEntry,
  __getOcrCacheSizeForTests,
} from '../domain/billingImportEngine/billingOcrCache';
import { normalizeOcrConfidence, confidenceClassFromScore } from '../domain/billingImportEngine/billingOcrConfidence';
import { BILLING_OCR_CONFIG } from '../domain/billingImportEngine/billingOcrConfig';
import { parseFieldInputValue, rebuildSessionPeriods } from '../domain/billingImportEngine/billingPeriodRecalculation';
import { aggregateCustomerCostBaseline } from '../domain/billingImportEngine/billingBaselineAggregation';
import { BILLING_FIELD_CODES } from '../domain/billingImport/billingFieldCodes';
import type { ExtractedBillingField } from '../domain/billingImport/extractedBillingField';
import { BrowserOcrExtractionProvider } from '../domain/billingImportEngine/providers/browserOcrExtractionProvider';
import { MockBillingExtractionProvider } from '../domain/billingImportEngine/providers/mockBillingExtractionProvider';
import { UnavailableOcrExtractionProvider } from '../domain/billingImportEngine/providers/unavailableOcrExtractionProvider';

describe('A11.2 OCR – PDF-Textqualität', () => {
  it('lehnt leeren Text ab', () => {
    const result = assessEmbeddedTextQuality('');
    expect(result.sufficient).toBe(false);
  });

  it('akzeptiert ausreichenden Abrechnungstext', () => {
    const text =
      'Rechnung Abrechnung Januar 2026 Umsatz 12.450,00 EUR Transaktionen 980 Gebühr Terminal Netto';
    const result = assessEmbeddedTextQuality(text);
    expect(result.sufficient).toBe(true);
    expect(result.keywordHits).toBeGreaterThan(0);
  });

  it('lehnt kurzen unbrauchbaren Text ab', () => {
    const result = assessEmbeddedTextQuality('@@@@ ####');
    expect(result.sufficient).toBe(false);
  });
});

describe('A11.2 OCR – Konfidenz', () => {
  it('normalisiert Tesseract-Werte auf 0–100', () => {
    expect(normalizeOcrConfidence(0.92)).toBe(92);
    expect(normalizeOcrConfidence(75)).toBe(75);
  });

  it('klassifiziert Schwellen zentral', () => {
    expect(confidenceClassFromScore(90)).toBe('high');
    expect(confidenceClassFromScore(70)).toBe('medium');
    expect(confidenceClassFromScore(40)).toBe('low');
    expect(confidenceClassFromScore(0)).toBe('unknown');
  });
});

describe('A11.2 OCR – Cache', () => {
  beforeEach(() => {
    clearOcrCache();
  });

  it('speichert und liefert Einträge', () => {
    const key = buildOcrCacheKey({
      contentFingerprint: 'sha256:abc',
      pageNumber: 1,
      rotationDegrees: 0,
      preprocessingProfile: 'default',
      providerVersion: '1.0.0',
      language: 'deu',
    });
    setOcrCacheEntry(key, {
      pages: [],
      providerId: BILLING_OCR_CONFIG.providerId,
      providerVersion: BILLING_OCR_CONFIG.providerVersion,
      language: 'deu',
      preprocessingProfile: 'default',
    });
    expect(getOcrCacheEntry(key)?.providerId).toBe(BILLING_OCR_CONFIG.providerId);
  });

  it('invalidiert bei geänderter Rotation', () => {
    const base = {
      contentFingerprint: 'sha256:abc',
      pageNumber: 1,
      preprocessingProfile: 'default',
      providerVersion: '1.0.0',
      language: 'deu',
    };
    const key0 = buildOcrCacheKey({ ...base, rotationDegrees: 0 });
    const key90 = buildOcrCacheKey({ ...base, rotationDegrees: 90 });
    setOcrCacheEntry(key0, {
      pages: [],
      providerId: 'a',
      providerVersion: '1',
      language: 'deu',
      preprocessingProfile: 'default',
    });
    expect(getOcrCacheEntry(key90)).toBeNull();
  });

  it('invalidiert per Fingerprint', () => {
    const key = buildOcrCacheKey({
      contentFingerprint: 'sha256:xyz',
      pageNumber: 1,
      rotationDegrees: 0,
      preprocessingProfile: 'default',
      providerVersion: '1.0.0',
      language: 'deu',
    });
    setOcrCacheEntry(key, {
      pages: [],
      providerId: 'a',
      providerVersion: '1',
      language: 'deu',
      preprocessingProfile: 'default',
    });
    invalidateOcrCacheForFingerprint('sha256:xyz');
    expect(__getOcrCacheSizeForTests()).toBe(0);
  });
});

describe('A11.2 – Feldkorrektur und Periodenneuberechnung', () => {
  const baseField = (overrides: Partial<ExtractedBillingField>): ExtractedBillingField => ({
    id: overrides.id ?? 'field_1',
    documentId: 'doc_1',
    pageNumber: 1,
    fieldCode: BILLING_FIELD_CODES.TOTAL_AMOUNT,
    fieldCategory: 'total',
    originalText: '244,90 EUR',
    rawValue: '244,90',
    normalizedValue: 24490,
    unit: null,
    currency: 'EUR',
    confidence: 80,
    confidenceClass: 'medium',
    detectionMethod: 'ocr',
    sourceLine: null,
    status: 'review_required',
    originalDetectedValue: 24490,
    correctedValue: null,
    correctedByUserId: null,
    correctedAt: null,
    comment: '',
    candidateGroupId: null,
    ...overrides,
  });

  it('parst deutsche Geldbeträge', () => {
    const parsed = parseFieldInputValue(BILLING_FIELD_CODES.TOTAL_AMOUNT, '1.234,56');
    expect(parsed.ok && parsed.value).toBe(123456);
  });

  it('lehnt leere Korrektur ab', () => {
    const parsed = parseFieldInputValue(BILLING_FIELD_CODES.TOTAL_AMOUNT, '   ');
    expect(parsed.ok).toBe(false);
  });

  it('berechnet Perioden nach Gebührenposition neu', () => {
    const fields = [
      baseField({
        fieldCode: BILLING_FIELD_CODES.PERIOD_FROM,
        normalizedValue: '2026-01-01',
        fieldCategory: 'period',
        status: 'confirmed',
      }),
      baseField({
        id: 'field_2',
        fieldCode: BILLING_FIELD_CODES.PERIOD_TO,
        normalizedValue: '2026-01-31',
        fieldCategory: 'period',
        status: 'confirmed',
      }),
      baseField({ id: 'field_3', normalizedValue: 10000, status: 'confirmed' }),
    ];
    const periods = rebuildSessionPeriods({
      sessionId: 'session_1',
      documents: [{ id: 'doc_1' }],
      fields,
      lineItems: [
        {
          id: 'line_1',
          sessionId: 'session_1',
          documentId: 'doc_1',
          periodId: null,
          category: 'transaction_fee',
          label: 'Transaktionsgebühr',
          amountCents: 500,
          currency: 'EUR',
          costType: 'recurring',
          quantity: null,
          unit: null,
          included: true,
          source: 'manual',
          pageNumber: null,
          comment: '',
          createdByUserId: 'user_1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(periods).toHaveLength(1);
    expect(periods[0]?.transactionCostsCents).toBe(500);
  });
});

describe('A11.2 – Snapshot-Erweiterung', () => {
  it('speichert OCR-Metadaten im Snapshot', () => {
    const baseline = aggregateCustomerCostBaseline({
      sessionId: 'session_1',
      leadId: 'lead_1',
      offerId: 'offer_1',
      documents: [],
      fields: [],
      periods: [],
      confirmedByUserId: 'user_1',
      providerIds: [BILLING_OCR_CONFIG.providerId],
      providerVersions: { ocr: BILLING_OCR_CONFIG.providerVersion },
      inputFingerprint: 'fp',
      documentRotations: { doc_1: 90 },
      costLineItems: [],
    });
    expect(baseline.snapshot.schemaVersion).toBe(2);
    expect(baseline.snapshot.ocrLanguageModel).toBe('deu');
    expect(baseline.snapshot.documentRotations?.doc_1).toBe(90);
  });
});

describe('A11.2 – Provider-Wiring', () => {
  it('nutzt BrowserOcrExtractionProvider produktiv', () => {
    const provider = new BrowserOcrExtractionProvider();
    expect(provider.providerId).toBe(BILLING_OCR_CONFIG.providerId);
  });

  it('Mock nur im Demo-Modus', () => {
    vi.stubEnv('VITE_BILLING_DEMO_OCR', 'true');
    expect(import.meta.env.VITE_BILLING_DEMO_OCR).toBe('true');
    vi.unstubAllEnvs();
  });

  it('Unavailable-Fallback liefert strukturierten Fehler', async () => {
    const provider = new UnavailableOcrExtractionProvider();
    const result = await provider.extractDocument({
      documentId: 'doc_1',
      fileName: 'scan.jpg',
      mimeType: 'image/jpeg',
      content: new Uint8Array([1, 2, 3]).buffer,
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toContain('OCR');
  });

  it('Mock-Provider ist klar als Demo gekennzeichnet', () => {
    const provider = new MockBillingExtractionProvider();
    expect(provider.providerId).toContain('mock');
  });
});
