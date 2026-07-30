import {
  BILLING_FIELD_CATEGORY,
  BILLING_FIELD_CODES,
  type BillingFieldCode,
} from '../billingImport/billingFieldCodes';
import type { ExtractedBillingField } from '../billingImport/extractedBillingField';
import { generateId } from '../../utils/id';
import { parseIntegerText, parseMoneyText, parsePercentText } from './billingMoneyParser';
import { parsePeriodFromText } from './billingPeriodParser';

export interface BillingTextBlock {
  pageNumber: number;
  text: string;
  lineNumber: number;
  confidence: number;
}

interface FieldPattern {
  code: BillingFieldCode;
  pattern: RegExp;
  valueFromLine?: (line: string) => string | number | null;
}

function confidenceClass(confidence: number): ExtractedBillingField['confidenceClass'] {
  if (confidence >= 0.85) {
    return 'high';
  }
  if (confidence >= 0.6) {
    return 'medium';
  }
  if (confidence > 0) {
    return 'low';
  }
  return 'unknown';
}

function createFieldCandidate(
  documentId: string,
  pageNumber: number,
  code: BillingFieldCode,
  originalText: string,
  normalizedValue: string | number | null,
  confidence: number,
  detectionMethod: ExtractedBillingField['detectionMethod'],
  sourceLine: string,
  candidateGroupId: string | null = null,
): ExtractedBillingField {
  const money = typeof normalizedValue === 'number' ? null : parseMoneyText(originalText);
  const currency = money?.currency ?? (code === BILLING_FIELD_CODES.CURRENCY ? String(normalizedValue) : null);

  return {
    id: generateId('billing_field'),
    documentId,
    pageNumber,
    fieldCode: code,
    fieldCategory: BILLING_FIELD_CATEGORY[code],
    originalText,
    rawValue: originalText,
    normalizedValue: money ? money.amountCents : normalizedValue,
    unit: money ? 'cents' : code === BILLING_FIELD_CODES.TRANSACTION_COUNT ? 'count' : null,
    currency,
    confidence,
    confidenceClass: confidenceClass(confidence),
    detectionMethod,
    sourceLine,
    status: confidence >= 0.85 ? 'detected' : 'review_required',
    originalDetectedValue: money ? money.amountCents : normalizedValue,
    correctedValue: null,
    correctedByUserId: null,
    correctedAt: null,
    comment: '',
    candidateGroupId,
  };
}

const FIELD_PATTERNS: FieldPattern[] = [
  {
    code: BILLING_FIELD_CODES.CARD_VOLUME,
    pattern: /(?:Kartenumsatz|Kartentransaktionsvolumen|Umsatz\s+Karten)/i,
    valueFromLine: (line) => parseMoneyText(line)?.amountCents ?? null,
  },
  {
    code: BILLING_FIELD_CODES.TRANSACTION_COUNT,
    pattern: /(?:Transaktionen|Anzahl\s+Transaktionen|Transaktionsanzahl)/i,
    valueFromLine: (line) => {
      const match = line.match(/(\d[\d.\s]*)\s*(?:Transaktionen|Tx)/i);
      return match?.[1] ? parseIntegerText(match[1]) : parseIntegerText(line);
    },
  },
  {
    code: BILLING_FIELD_CODES.MONTHLY_BASE_FEE,
    pattern: /(?:Grundgebühr|Monatliche\s+Grundgebühr|Kontoführung)/i,
    valueFromLine: (line) => parseMoneyText(line)?.amountCents ?? null,
  },
  {
    code: BILLING_FIELD_CODES.TERMINAL_RENTAL,
    pattern: /(?:Terminalmiete|Miete\s+Terminal|Gerätemiete)/i,
    valueFromLine: (line) => parseMoneyText(line)?.amountCents ?? null,
  },
  {
    code: BILLING_FIELD_CODES.TRANSACTION_FEES_TOTAL,
    pattern: /(?:Transaktionsgebühren|Gebühren\s+je\s+Transaktion\s+gesamt)/i,
    valueFromLine: (line) => parseMoneyText(line)?.amountCents ?? null,
  },
  {
    code: BILLING_FIELD_CODES.CLEARING_FEE,
    pattern: /(?:Clearing|Girocard\s+Clearing)/i,
    valueFromLine: (line) => parseMoneyText(line)?.amountCents ?? null,
  },
  {
    code: BILLING_FIELD_CODES.TOTAL_AMOUNT,
    pattern: /(?:Rechnungsbetrag|Gesamtbetrag|Summe\s+netto|Endbetrag)/i,
    valueFromLine: (line) => parseMoneyText(line)?.amountCents ?? null,
  },
  {
    code: BILLING_FIELD_CODES.INVOICE_NUMBER,
    pattern: /(?:Rechnungsnummer|Rechnung\s*Nr\.?|Invoice\s*No\.?)/i,
    valueFromLine: (line) => line.replace(/.*?:\s*/, '').trim(),
  },
  {
    code: BILLING_FIELD_CODES.CUSTOMER_NUMBER,
    pattern: /(?:Kundennummer|Kunden-Nr\.?|Customer\s*No\.?)/i,
    valueFromLine: (line) => line.replace(/.*?:\s*/, '').trim(),
  },
];

export function detectBillingFieldCandidates(
  documentId: string,
  blocks: BillingTextBlock[],
  detectionMethod: ExtractedBillingField['detectionMethod'],
): ExtractedBillingField[] {
  const candidates: ExtractedBillingField[] = [];
  const groups = new Map<BillingFieldCode, string>();

  for (const block of blocks) {
    const lines = block.text.split('\n').map((line) => line.trim()).filter(Boolean);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!;

      for (const pattern of FIELD_PATTERNS) {
        if (!pattern.pattern.test(line)) {
          continue;
        }

        const groupId = groups.get(pattern.code) ?? generateId('field_group');
        groups.set(pattern.code, groupId);

        const normalized = pattern.valueFromLine?.(line) ?? null;
        if (normalized === null && pattern.code !== BILLING_FIELD_CODES.INVOICE_NUMBER) {
          continue;
        }

        candidates.push(
          createFieldCandidate(
            documentId,
            block.pageNumber,
            pattern.code,
            line,
            normalized,
            block.confidence,
            detectionMethod,
            line,
            groupId,
          ),
        );
      }

      const period = parsePeriodFromText(line);
      if (period) {
        candidates.push(
          createFieldCandidate(
            documentId,
            block.pageNumber,
            BILLING_FIELD_CODES.PERIOD_FROM,
            period.rawText,
            period.periodFrom,
            block.confidence,
            detectionMethod,
            line,
          ),
          createFieldCandidate(
            documentId,
            block.pageNumber,
            BILLING_FIELD_CODES.PERIOD_TO,
            period.rawText,
            period.periodTo,
            block.confidence,
            detectionMethod,
            line,
          ),
        );
      }

      if (/^EUR|€/.test(line) || /\bEUR\b/.test(line)) {
        candidates.push(
          createFieldCandidate(
            documentId,
            block.pageNumber,
            BILLING_FIELD_CODES.CURRENCY,
            line,
            'EUR',
            block.confidence,
            detectionMethod,
            line,
          ),
        );
      }

      const percent = parsePercentText(line);
      if (percent && /disagio|entgelt|gebühr/i.test(line)) {
        candidates.push(
          createFieldCandidate(
            documentId,
            block.pageNumber,
            BILLING_FIELD_CODES.VOLUME_BASED_FEE_PERCENT,
            line,
            percent.percentTenthsOfBasisPoint,
            block.confidence * 0.8,
            detectionMethod,
            line,
          ),
        );
      }

      if (/gutschrift|credit note|storno/i.test(line)) {
        const amount = parseMoneyText(line);
        if (amount) {
          candidates.push(
            createFieldCandidate(
              documentId,
              block.pageNumber,
              BILLING_FIELD_CODES.CREDIT_NOTE,
              line,
              amount.amountCents,
              block.confidence,
              detectionMethod,
              line,
            ),
          );
        }
      }
    }
  }

  return candidates;
}

export function resolveFieldConflicts(
  fields: ExtractedBillingField[],
): { resolved: ExtractedBillingField[]; conflicts: ExtractedBillingField[][] } {
  const byCode = new Map<BillingFieldCode, ExtractedBillingField[]>();
  for (const field of fields) {
    if (field.status === 'rejected') {
      continue;
    }
    const list = byCode.get(field.fieldCode) ?? [];
    list.push(field);
    byCode.set(field.fieldCode, list);
  }

  const resolved: ExtractedBillingField[] = [];
  const conflicts: ExtractedBillingField[][] = [];

  for (const [, group] of byCode) {
    if (group.length === 1) {
      resolved.push(group[0]!);
      continue;
    }

    const uniqueValues = new Set(
      group.map((field) => String(field.normalizedValue ?? field.rawValue)),
    );
    if (uniqueValues.size === 1) {
      resolved.push(group[0]!);
      continue;
    }

    const confirmed = group.find((field) => field.status === 'confirmed' || field.status === 'corrected');
    if (confirmed) {
      resolved.push(confirmed);
      continue;
    }

    conflicts.push(group);
    for (const field of group) {
      resolved.push({ ...field, status: 'review_required' });
    }
  }

  return { resolved, conflicts };
}

export function getConfirmedFieldValue(
  fields: ExtractedBillingField[],
  code: BillingFieldCode,
): number | string | null {
  const relevant = fields.filter(
    (field) =>
      field.fieldCode === code &&
      field.status !== 'rejected' &&
      (field.status === 'confirmed' ||
        field.status === 'corrected' ||
        field.status === 'detected' ||
        field.status === 'manually_added'),
  );

  const preferred =
    relevant.find((field) => field.status === 'confirmed' || field.status === 'corrected') ??
    relevant[0];

  if (!preferred) {
    return null;
  }

  return preferred.correctedValue ?? preferred.normalizedValue;
}
