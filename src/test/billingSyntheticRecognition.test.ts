import { describe, expect, it } from 'vitest';
import { BILLING_FIELD_CODES } from '../domain/billingImport/billingFieldCodes';
import {
  detectBillingFieldCandidates,
  resolveFieldConflicts,
} from '../domain/billingImportEngine/billingFieldRecognition';
import { parseMoneyText } from '../domain/billingImportEngine/billingMoneyParser';
import {
  SYNTHETIC_AMBIGUOUS_SUMS_TEXT,
  SYNTHETIC_CLEAR_BILLING_TEXT,
  SYNTHETIC_NOISY_BILLING_TEXT,
} from './fixtures/syntheticBillingText';

function fieldsFrom(text: string) {
  return detectBillingFieldCandidates(
    'doc_synthetic',
    [{ pageNumber: 1, text, lineNumber: 1, confidence: 0.9 }],
    'pdf_text',
  );
}

describe('Synthetische Abrechnungserkennung (Fixture, kein Mock-OCR)', () => {
  it('erkennt klare PDF-ähnliche Werte ohne erfundene Defaults', () => {
    const fields = fieldsFrom(SYNTHETIC_CLEAR_BILLING_TEXT);
    const byCode = (code: string) =>
      fields.find((field) => field.fieldCode === code)?.normalizedValue ?? null;

    expect(byCode(BILLING_FIELD_CODES.PROVIDER_NAME)).toBe('SumUp');
    expect(byCode(BILLING_FIELD_CODES.CARD_VOLUME)).toBe(1_234_567);
    expect(byCode(BILLING_FIELD_CODES.TRANSACTION_COUNT)).toBe(420);
    expect(byCode(BILLING_FIELD_CODES.TOTAL_AMOUNT)).toBe(8_950);
    expect(byCode(BILLING_FIELD_CODES.MONTHLY_BASE_FEE)).toBe(2_900);
    expect(byCode(BILLING_FIELD_CODES.TERMINAL_RENTAL)).toBe(1_900);
    expect(byCode(BILLING_FIELD_CODES.TRANSACTION_FEES_TOTAL)).toBe(4_150);
  });

  it('lässt unsichere/noisy Werte prüfbar und erfindet keine Umsätze', () => {
    const fields = fieldsFrom(SYNTHETIC_NOISY_BILLING_TEXT);
    const volume = fields.find((field) => field.fieldCode === BILLING_FIELD_CODES.CARD_VOLUME);
    expect(volume ?? null).toBeNull();
    const totals = fields.filter((field) => field.fieldCode === BILLING_FIELD_CODES.TOTAL_AMOUNT);
    expect(totals.some((field) => field.normalizedValue === 4_500 || field.normalizedValue === 5_355)).toBe(
      true,
    );
  });

  it('markiert mehrdeutige Summen als prüfbedürftig und verwechselt 12,50 nicht mit 1.250', () => {
    expect(parseMoneyText('12,50 EUR')?.amountCents).toBe(1_250);
    expect(parseMoneyText('1.234,56 EUR')?.amountCents).toBe(123_456);

    const fields = fieldsFrom(SYNTHETIC_AMBIGUOUS_SUMS_TEXT);
    const { resolved } = resolveFieldConflicts(fields);
    const totals = resolved.filter((field) => field.fieldCode === BILLING_FIELD_CODES.TOTAL_AMOUNT);
    expect(totals.length).toBeGreaterThan(1);
    expect(totals.every((field) => field.status === 'review_required')).toBe(true);
    expect(
      fields.find((field) => field.fieldCode === BILLING_FIELD_CODES.PROVIDER_NAME)?.normalizedValue,
    ).toBe('TeleCash');
  });
});
