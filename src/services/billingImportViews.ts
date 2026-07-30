import type { BillingCostLineItem } from '../domain/billingImport/billingCostLineItem';
import { BILLING_COST_LINE_CATEGORY_LABELS } from '../domain/billingImport/billingCostLineItem';
import type { BillingImportSession } from '../domain/billingImport/billingImportSession';
import type { BillingPeriodRecord } from '../domain/billingImport/billingPeriodRecord';
import type { CustomerCostBaseline } from '../domain/billingImport/customerCostBaseline';
import type { ExtractedBillingField } from '../domain/billingImport/extractedBillingField';
import type { BillingImportFinding } from '../domain/billingImport/billingImportFinding';
import type { BillingSourceDocument } from '../domain/billingImport/billingSourceDocument';
import { BILLING_FIELD_CODES } from '../domain/billingImport/billingFieldCodes';
import type { BillingExtractionProgress } from '../domain/billingImportEngine/billingOcrConfig';

const FIELD_LABELS: Record<string, string> = {
  [BILLING_FIELD_CODES.PROVIDER_NAME]: 'Anbieter (Quelle)',
  [BILLING_FIELD_CODES.INVOICE_NUMBER]: 'Rechnungsnummer',
  [BILLING_FIELD_CODES.BILLING_NUMBER]: 'Abrechnungsnummer',
  [BILLING_FIELD_CODES.CUSTOMER_NUMBER]: 'Kundennummer',
  [BILLING_FIELD_CODES.PERIOD_FROM]: 'Zeitraum von',
  [BILLING_FIELD_CODES.PERIOD_TO]: 'Zeitraum bis',
  [BILLING_FIELD_CODES.CURRENCY]: 'Währung',
  [BILLING_FIELD_CODES.CARD_VOLUME]: 'Kartenumsatz',
  [BILLING_FIELD_CODES.TRANSACTION_COUNT]: 'Transaktionen',
  [BILLING_FIELD_CODES.AVERAGE_TICKET]: 'Durchschnittlicher Zahlbetrag',
  [BILLING_FIELD_CODES.MONTHLY_BASE_FEE]: 'Grundgebühr',
  [BILLING_FIELD_CODES.TERMINAL_RENTAL]: 'Terminalmiete',
  [BILLING_FIELD_CODES.TRANSACTION_FEES_TOTAL]: 'Transaktionsgebühren',
  [BILLING_FIELD_CODES.VOLUME_BASED_FEES_TOTAL]: 'Umsatzabhängige Gebühren',
  [BILLING_FIELD_CODES.CLEARING_FEE]: 'Clearinggebühr',
  [BILLING_FIELD_CODES.SERVICE_FEE]: 'Servicegebühr',
  [BILLING_FIELD_CODES.ONE_TIME_FEE]: 'Einmalige Gebühr',
  [BILLING_FIELD_CODES.CREDIT_NOTE]: 'Gutschrift',
  [BILLING_FIELD_CODES.TOTAL_AMOUNT]: 'Gesamtbetrag',
  [BILLING_FIELD_CODES.VOLUME_BASED_FEE_PERCENT]: 'Umsatzgebühr (%)',
};

export type BillingFieldInputType = 'money' | 'integer' | 'percent' | 'date' | 'text';

export interface SalesBillingDocumentView {
  id: string;
  fileName: string;
  pageCount: number;
  extractionStatus: string;
  documentType: string;
  duplicateStatus: string;
  periodLabel: string;
  averageConfidenceLabel: string;
  errorMessage: string | null;
  previewUrl: string | null;
  rotationDegrees: number;
  extractionProgress: BillingExtractionProgress | null;
}

export interface SalesBillingFieldCandidateView {
  id: string;
  normalizedValueLabel: string;
  originalText: string;
  confidenceClass: string;
  pageNumber: number | null;
  status: string;
}

export interface SalesBillingFieldView {
  id: string;
  fieldCode: string;
  label: string;
  inputType: BillingFieldInputType;
  normalizedValueLabel: string;
  editValue: string;
  originalDetectedLabel: string;
  originalText: string;
  confidenceClass: string;
  status: string;
  pageNumber: number | null;
  documentId: string;
  candidateGroupId: string | null;
  candidates: SalesBillingFieldCandidateView[];
  unit: string | null;
  currency: string | null;
}

export interface SalesBillingCostLineView {
  id: string;
  label: string;
  categoryLabel: string;
  amountLabel: string;
  costType: string;
  included: boolean;
  source: string;
  comment: string;
}

export interface SalesBillingPeriodView {
  id: string;
  periodLabel: string;
  cardVolumeLabel: string;
  transactionCountLabel: string;
  fixedCostsLabel: string;
  variableCostsLabel: string;
  totalLabel: string;
  qualityStatus: string;
  statusLabel: string;
  flags: string[];
  isPreview: boolean;
}

export interface SalesBillingBaselineView {
  id: string;
  version: number;
  status: string;
  qualityStatus: string;
  coverageLabel: string;
  avgMonthlyVolumeLabel: string;
  avgMonthlyTransactionsLabel: string;
  avgMonthlyTotalCostsLabel: string;
  oneTimeCostsLabel: string;
  periodCount: number;
  fullMonthCount: number;
  isPreview: boolean;
}

export interface SalesBillingImportView {
  sessionId: string | null;
  sessionStatus: string;
  documents: SalesBillingDocumentView[];
  fields: SalesBillingFieldView[];
  fieldGroups: Array<{ fieldCode: string; label: string; fields: SalesBillingFieldView[] }>;
  periods: SalesBillingPeriodView[];
  costLineItems: SalesBillingCostLineView[];
  baseline: SalesBillingBaselineView | null;
  baselinePreview: SalesBillingBaselineView | null;
  findings: Array<{
    code: string;
    salesDescription: string;
    severity: string;
    blocking: boolean;
  }>;
  canConfirm: boolean;
  blockingCount: number;
  supportedFormatsLabel: string;
  recommendationStaleHint: boolean;
  localOcrEnabled: boolean;
  privacyNotice: string;
}

function formatCents(value: number | null, currency = 'EUR'): string {
  if (value === null) {
    return '—';
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value / 100);
}

function fieldInputType(fieldCode: string): BillingFieldInputType {
  const money = new Set([
    BILLING_FIELD_CODES.CARD_VOLUME,
    BILLING_FIELD_CODES.MONTHLY_BASE_FEE,
    BILLING_FIELD_CODES.TERMINAL_RENTAL,
    BILLING_FIELD_CODES.TRANSACTION_FEES_TOTAL,
    BILLING_FIELD_CODES.CLEARING_FEE,
    BILLING_FIELD_CODES.TOTAL_AMOUNT,
    BILLING_FIELD_CODES.ONE_TIME_FEE,
    BILLING_FIELD_CODES.CREDIT_NOTE,
  ]);
  if (money.has(fieldCode as typeof BILLING_FIELD_CODES.CARD_VOLUME)) {
    return 'money';
  }
  if (fieldCode === BILLING_FIELD_CODES.TRANSACTION_COUNT || fieldCode === BILLING_FIELD_CODES.TERMINAL_COUNT) {
    return 'integer';
  }
  if (fieldCode === BILLING_FIELD_CODES.VOLUME_BASED_FEE_PERCENT) {
    return 'percent';
  }
  if (fieldCode === BILLING_FIELD_CODES.PERIOD_FROM || fieldCode === BILLING_FIELD_CODES.PERIOD_TO) {
    return 'date';
  }
  return 'text';
}

function formatFieldValue(field: ExtractedBillingField): string {
  if (field.normalizedValue === null || field.normalizedValue === '') {
    return '—';
  }
  if (typeof field.normalizedValue === 'number' && field.unit === 'cents') {
    return formatCents(field.normalizedValue, field.currency ?? 'EUR');
  }
  if (field.fieldCode === BILLING_FIELD_CODES.VOLUME_BASED_FEE_PERCENT && typeof field.normalizedValue === 'number') {
    return `${(field.normalizedValue / 1000).toFixed(3).replace('.', ',')} %`;
  }
  return String(field.normalizedValue);
}

function formatEditValue(field: ExtractedBillingField): string {
  if (field.correctedValue !== null && field.correctedValue !== undefined) {
    return String(field.correctedValue);
  }
  if (typeof field.normalizedValue === 'number' && field.unit === 'cents') {
    return (field.normalizedValue / 100).toFixed(2).replace('.', ',');
  }
  return field.normalizedValue === null ? '' : String(field.normalizedValue);
}

function periodLabel(from: string | null, to: string | null): string {
  if (!from && !to) {
    return '—';
  }
  return `${from ?? '?'} – ${to ?? '?'}`;
}

function toBaselineView(baseline: CustomerCostBaseline, isPreview: boolean): SalesBillingBaselineView {
  return {
    id: baseline.id,
    version: baseline.version,
    status: baseline.status,
    qualityStatus: baseline.qualityStatus,
    coverageLabel: periodLabel(baseline.coverageFrom, baseline.coverageTo),
    avgMonthlyVolumeLabel: formatCents(baseline.avgMonthlyCardVolumeCents, baseline.currency),
    avgMonthlyTransactionsLabel:
      baseline.avgMonthlyTransactionCount !== null
        ? String(baseline.avgMonthlyTransactionCount)
        : '—',
    avgMonthlyTotalCostsLabel: formatCents(baseline.avgMonthlyTotalCostsCents, baseline.currency),
    oneTimeCostsLabel: formatCents(baseline.totalOneTimeCostsCents, baseline.currency),
    periodCount: baseline.confirmedPeriodCount,
    fullMonthCount: baseline.fullMonthCount,
    isPreview,
  };
}

export function toSalesBillingImportView(input: {
  session: BillingImportSession | null;
  documents: Array<
    BillingSourceDocument & {
      previewUrl?: string | null;
      rotationDegrees?: number;
      extractionProgress?: BillingExtractionProgress | null;
    }
  >;
  fields: ExtractedBillingField[];
  periods: BillingPeriodRecord[];
  costLineItems?: BillingCostLineItem[];
  baseline: CustomerCostBaseline | null;
  baselinePreview?: CustomerCostBaseline | null;
  findings: BillingImportFinding[];
  recommendationHasBaselineLink: boolean;
}): SalesBillingImportView {
  const blockingCount = input.findings.filter((finding) => finding.blocking).length;

  const fieldViews: SalesBillingFieldView[] = input.fields
    .filter((field) => field.fieldCode !== BILLING_FIELD_CODES.PROVIDER_NAME)
    .map((field) => {
      const candidates = input.fields.filter(
        (candidate) =>
          candidate.candidateGroupId &&
          candidate.candidateGroupId === field.candidateGroupId &&
          candidate.fieldCode === field.fieldCode,
      );
      const uniqueCandidates =
        candidates.length > 1
          ? candidates
          : candidates.length === 1
            ? candidates
            : [field];

      return {
        id: field.id,
        fieldCode: field.fieldCode,
        label: FIELD_LABELS[field.fieldCode] ?? field.fieldCode,
        inputType: fieldInputType(field.fieldCode),
        normalizedValueLabel: formatFieldValue(field),
        editValue: formatEditValue(field),
        originalDetectedLabel:
          field.originalDetectedValue === null ? '—' : String(field.originalDetectedValue),
        originalText: field.originalText,
        confidenceClass: field.confidenceClass,
        status: field.status,
        pageNumber: field.pageNumber,
        documentId: field.documentId,
        candidateGroupId: field.candidateGroupId,
        candidates: uniqueCandidates.map((candidate) => ({
          id: candidate.id,
          normalizedValueLabel: formatFieldValue(candidate),
          originalText: candidate.originalText,
          confidenceClass: candidate.confidenceClass,
          pageNumber: candidate.pageNumber,
          status: candidate.status,
        })),
        unit: field.unit,
        currency: field.currency,
      };
    });

  const dedupedFields = fieldViews.filter((field, index, list) => {
    if (!field.candidateGroupId) {
      return true;
    }
    return list.findIndex(
      (entry) =>
        entry.candidateGroupId === field.candidateGroupId && entry.fieldCode === field.fieldCode,
    ) === index;
  });

  const fieldGroups = Array.from(
    dedupedFields.reduce((map, field) => {
      const list = map.get(field.fieldCode) ?? [];
      list.push(field);
      map.set(field.fieldCode, list);
      return map;
    }, new Map<string, SalesBillingFieldView[]>()),
  ).map(([fieldCode, fields]) => ({
    fieldCode,
    label: FIELD_LABELS[fieldCode] ?? fieldCode,
    fields,
  }));

  return {
    sessionId: input.session?.id ?? null,
    sessionStatus: input.session?.status ?? 'none',
    documents: input.documents.map((document) => ({
      id: document.id,
      fileName: document.originalFileName,
      pageCount: document.pageCount,
      extractionStatus: document.extractionStatus,
      documentType: document.documentType,
      duplicateStatus: document.duplicateStatus,
      periodLabel: periodLabel(document.periodFrom, document.periodTo),
      averageConfidenceLabel:
        document.averageConfidence !== null
          ? `${Math.round(document.averageConfidence * 100)} %`
          : '—',
      errorMessage: document.errorMessage,
      previewUrl: document.previewUrl ?? null,
      rotationDegrees: document.rotationDegrees ?? 0,
      extractionProgress: document.extractionProgress ?? null,
    })),
    fields: dedupedFields,
    fieldGroups,
    periods: input.periods.map((period) => ({
      id: period.id,
      periodLabel: periodLabel(period.periodFrom, period.periodTo),
      cardVolumeLabel: formatCents(period.cardVolumeCents, period.currency),
      transactionCountLabel:
        period.transactionCount !== null ? String(period.transactionCount) : '—',
      fixedCostsLabel: formatCents(period.fixedCostsCents, period.currency),
      variableCostsLabel: formatCents(
        (period.transactionCostsCents ?? 0) + (period.volumeBasedCostsCents ?? 0),
        period.currency,
      ),
      totalLabel: formatCents(period.totalAmountCents, period.currency),
      qualityStatus: period.qualityStatus,
      statusLabel: period.confirmationStatus,
      flags: [
        period.isPartialPeriod ? 'Teilmonat' : '',
        period.isFullMonth ? 'Voller Monat' : '',
        period.outlierStatus !== 'none' ? 'Ausreißer' : '',
      ].filter(Boolean),
      isPreview: period.confirmationStatus !== 'confirmed',
    })),
    costLineItems: (input.costLineItems ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      categoryLabel: BILLING_COST_LINE_CATEGORY_LABELS[item.category],
      amountLabel: formatCents(item.amountCents, item.currency),
      costType: item.costType,
      included: item.included,
      source: item.source,
      comment: item.comment,
    })),
    baseline: input.baseline ? toBaselineView(input.baseline, false) : null,
    baselinePreview: input.baselinePreview ? toBaselineView(input.baselinePreview, true) : null,
    findings: input.findings.map((finding) => ({
      code: finding.code,
      salesDescription: finding.salesDescription ?? finding.internalDescription,
      severity: finding.severity,
      blocking: finding.blocking,
    })),
    canConfirm:
      input.session !== null &&
      input.session.status !== 'confirmed' &&
      input.periods.length > 0 &&
      blockingCount === 0,
    blockingCount,
    supportedFormatsLabel: 'PDF, JPG, PNG, WEBP – OCR lokal im Browser',
    recommendationStaleHint: input.recommendationHasBaselineLink,
    localOcrEnabled: true,
    privacyNotice: 'OCR wird lokal im Browser ausgeführt. Kundendokumente werden nicht an externe Dienste übertragen.',
  };
}
