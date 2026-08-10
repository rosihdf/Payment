import { describe, expect, it } from 'vitest';
import { BILLING_FIELD_CODES } from '../domain/billingImport/billingFieldCodes';
import { BILLING_OCR_CONFIG } from '../domain/billingImportEngine/billingOcrConfig';
import { detectBillingFieldCandidates } from '../domain/billingImportEngine/billingFieldRecognition';

/** OCR-Rohtext aus scripts/evaluate-ocr-languages.mjs (deu-only, Mixed-Language-Abrechnung). */
const DEU_ONLY_OCR_TEXT = `
SumUp Monthly Statement / Monatsabrechnung
Zeitraum: 01.01.2026 - 31.01.2026
Visa / Mastercard / Debit / Credit Card Volume
Kartenumsatz 12.345,67 EUR
Anzahl Transaktionen / Transactions 420
Terminal Rental / Terminalmiete 19,00 EUR
Service Fee / Servicegebühr 5,00 EUR
Clearing Fee / Clearing 12,50 EUR
Transaction Fee / Transaktionsgebühr 41,50 EUR
Total Amount / Monatliche Gesamtkosten 89,50 EUR
`.trim();

function fieldsFrom(text: string) {
  return detectBillingFieldCandidates(
    'doc_lang_eval',
    [{ pageNumber: 1, text, lineNumber: 1, confidence: 0.9 }],
    'ocr',
  );
}

describe('OCR O3 – Sprachmodell deu-only', () => {
  it('nutzt nur deu in der Produktkonfiguration', () => {
    expect(BILLING_OCR_CONFIG.languages).toBe('deu');
  });

  it('extrahiert fachliche Felder aus deu-OCR-Text mit EN-Begriffen', () => {
    const fields = fieldsFrom(DEU_ONLY_OCR_TEXT);
    const byCode = (code: string) =>
      fields.find((field) => field.fieldCode === code)?.normalizedValue ?? null;

    expect(byCode(BILLING_FIELD_CODES.PROVIDER_NAME)).toBe('SumUp');
    expect(byCode(BILLING_FIELD_CODES.CARD_VOLUME)).toBe(1_234_567);
    expect(byCode(BILLING_FIELD_CODES.TRANSACTION_COUNT)).toBe(420);
    expect(byCode(BILLING_FIELD_CODES.TOTAL_AMOUNT)).toBe(8_950);
    expect(byCode(BILLING_FIELD_CODES.TERMINAL_RENTAL)).toBe(1_900);
    expect(fields.some((field) => field.normalizedValue === 4_150)).toBe(true);
  });
});
