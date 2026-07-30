import { describe, expect, it } from 'vitest';
import { parsePeriodFromText } from '../domain/billingImportEngine/billingPeriodParser';
import { detectBillingDuplicates } from '../domain/billingImportEngine/billingDuplicateDetection';
import { aggregateCustomerCostBaseline } from '../domain/billingImportEngine/billingBaselineAggregation';
import type { BillingPeriodRecord } from '../domain/billingImport/billingPeriodRecord';
import type { BillingSourceDocument } from '../domain/billingImport/billingSourceDocument';

function createPeriod(overrides: Partial<BillingPeriodRecord>): BillingPeriodRecord {
  return {
    id: overrides.id ?? 'period_1',
    sessionId: 'session_1',
    sourceDocumentIds: ['doc_1'],
    periodFrom: '2026-01-01',
    periodTo: '2026-01-31',
    calendarDays: 31,
    isFullMonth: true,
    isPartialPeriod: false,
    monthEquivalent: 1,
    currency: 'EUR',
    netGrossBasis: 'unknown',
    cardVolumeCents: 100_000_00,
    transactionCount: 1000,
    averageTicketCents: 100_00,
    fixedCostsCents: 29_90,
    terminalCostsCents: 15_00,
    transactionCostsCents: 120_00,
    volumeBasedCostsCents: 80_00,
    clearingCostsCents: null,
    serviceCostsCents: null,
    otherRecurringCostsCents: null,
    oneTimeCostsCents: null,
    creditAmountCents: null,
    taxAmountCents: null,
    totalAmountCents: 244_90,
    terminalCount: 1,
    cardMix: { girocardPercent: null, creditPercent: null, debitPercent: null },
    completenessScore: 80,
    qualityStatus: 'good',
    outlierStatus: 'none',
    outlierDecision: 'include',
    confirmationStatus: 'confirmed',
    findings: [],
    ...overrides,
  };
}

describe('billingPeriodParser', () => {
  it('erkennt vollen Kalendermonat', () => {
    const period = parsePeriodFromText('01.01.2026 – 31.01.2026');
    expect(period?.isFullMonth).toBe(true);
    expect(period?.periodFrom).toBe('2026-01-01');
  });

  it('kennzeichnet Teilmonate', () => {
    const period = parsePeriodFromText('15.01.2026 – 31.01.2026');
    expect(period?.isPartialPeriod).toBe(true);
  });
});

describe('billingDuplicateDetection', () => {
  it('erkennt exakte Dublette per Fingerprint', () => {
    const documents: BillingSourceDocument[] = [
      {
        id: 'doc_1',
        sessionId: 'session_1',
        originalFileName: 'a.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 100,
        pageCount: 1,
        contentFingerprint: 'sha256:abc',
        uploadOrder: 0,
        extractionStatus: 'pending',
        documentType: 'unknown',
        detectedProviderName: null,
        detectedCustomerNumber: null,
        detectedInvoiceNumber: null,
        periodFrom: null,
        periodTo: null,
        currency: null,
        netGrossBasis: 'unknown',
        averageConfidence: null,
        duplicateStatus: 'none',
        duplicateOfDocumentId: null,
        errorMessage: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'doc_2',
        sessionId: 'session_1',
        originalFileName: 'b.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 100,
        pageCount: 1,
        contentFingerprint: 'sha256:abc',
        uploadOrder: 1,
        extractionStatus: 'pending',
        documentType: 'unknown',
        detectedProviderName: null,
        detectedCustomerNumber: null,
        detectedInvoiceNumber: null,
        periodFrom: null,
        periodTo: null,
        currency: null,
        netGrossBasis: 'unknown',
        averageConfidence: null,
        duplicateStatus: 'none',
        duplicateOfDocumentId: null,
        errorMessage: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const result = detectBillingDuplicates(documents);
    expect(result.exactDuplicates).toHaveLength(1);
  });
});

describe('billingBaselineAggregation', () => {
  it('bildet gewichteten Monatsdurchschnitt aus mehreren Perioden', () => {
    const periods = [
      createPeriod({ id: 'p1', totalAmountCents: 200_00 }),
      createPeriod({ id: 'p2', periodFrom: '2026-02-01', periodTo: '2026-02-28', totalAmountCents: 300_00 }),
    ];

    const baseline = aggregateCustomerCostBaseline({
      sessionId: 'session_1',
      leadId: 'lead_1',
      offerId: 'offer_1',
      documents: [],
      fields: [],
      periods,
      confirmedByUserId: 'user_1',
      providerIds: ['pdf-text'],
      providerVersions: { pdf: '1' },
      inputFingerprint: 'fp',
    });

    expect(baseline.status).toBe('confirmed');
    expect(baseline.confirmedPeriodCount).toBe(2);
    expect(baseline.avgMonthlyTotalCostsCents).not.toBeNull();
  });

  it('blockiert Aggregation bei Währungskonflikt', () => {
    const periods = [
      createPeriod({ id: 'p1', currency: 'EUR' }),
      createPeriod({ id: 'p2', currency: 'USD', periodFrom: '2026-02-01', periodTo: '2026-02-28' }),
    ];

    const baseline = aggregateCustomerCostBaseline({
      sessionId: 'session_1',
      leadId: null,
      offerId: null,
      documents: [],
      fields: [],
      periods,
      confirmedByUserId: 'user_1',
      providerIds: [],
      providerVersions: {},
      inputFingerprint: 'fp',
    });

    expect(baseline.status).toBe('draft');
    expect(baseline.findings.some((finding) => finding.code === 'BILLING_CURRENCY_CONFLICT')).toBe(true);
  });
});
