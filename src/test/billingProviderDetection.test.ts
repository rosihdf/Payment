import { describe, expect, it } from 'vitest';
import { detectBillingProviderName } from '../domain/billingImportEngine/billingProviderDetection';
import { detectBillingFieldCandidates } from '../domain/billingImportEngine/billingFieldRecognition';
import { BILLING_FIELD_CODES } from '../domain/billingImport/billingFieldCodes';

describe('billingProviderDetection', () => {
  it('erkennt bekannte Anbieternamen', () => {
    expect(detectBillingProviderName('SumUp Monatsabrechnung März')?.name).toBe('SumUp');
    expect(detectBillingProviderName('VR Payment Gebührenübersicht')?.name).toBe('VR Payment');
  });

  it('erkennt gelabelte Anbieterzeilen', () => {
    expect(detectBillingProviderName('Bisheriger Anbieter: MusterPay GmbH')?.name).toBe(
      'MusterPay GmbH',
    );
  });

  it('erzeugt PROVIDER_NAME-Feldkandidaten aus Textblöcken', () => {
    const fields = detectBillingFieldCandidates(
      'doc_1',
      [
        {
          pageNumber: 1,
          text: 'SumUp\nKartenumsatz 12.345,67 EUR\nMonatliche Gesamtkosten 89,50 EUR',
          lineNumber: 1,
          confidence: 0.92,
        },
      ],
      'pdf_text',
    );
    const provider = fields.find((field) => field.fieldCode === BILLING_FIELD_CODES.PROVIDER_NAME);
    expect(provider?.normalizedValue).toBe('SumUp');
  });
});
