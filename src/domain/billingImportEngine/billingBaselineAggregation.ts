import type { BillingImportFinding } from '../billingImport/billingImportFinding';
import { createBillingFinding, BILLING_FINDING_CODES } from '../billingImport/billingImportFinding';
import type { BillingImportSnapshot } from '../billingImport/billingImportSnapshot';
import { BILLING_IMPORT_SNAPSHOT_SCHEMA_VERSION } from '../billingImport/billingImportSnapshot';
import type { BillingPeriodRecord } from '../billingImport/billingPeriodRecord';
import type { BillingPeriodQualityStatus } from '../billingImport/billingPeriodRecord';
import type { CustomerCostBaseline } from '../billingImport/customerCostBaseline';
import type { ExtractedBillingField } from '../billingImport/extractedBillingField';
import type { BillingSourceDocument } from '../billingImport/billingSourceDocument';
import { BILLING_IMPORT_ENGINE_VERSION } from '../billingImport/billingImportSession';
import type { BillingCostLineItem } from '../billingImport/billingCostLineItem';
import { BILLING_OCR_CONFIG } from './billingOcrConfig';
import { generateId } from '../../utils/id';
import { normalizePeriodToMonthlyAmount } from './billingPeriodParser';

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
  }
  return sorted[middle]!;
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number | null {
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }
  const weightedSum = values.reduce((sum, entry) => sum + entry.value * entry.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

function assessBaselineQuality(
  periods: BillingPeriodRecord[],
  findings: BillingImportFinding[],
): BillingPeriodQualityStatus {
  const fullMonths = periods.filter((period) => period.isFullMonth).length;
  if (periods.length === 0) {
    return 'unusable';
  }
  if (findings.some((finding) => finding.blocking)) {
    return 'poor';
  }
  if (fullMonths >= 3 && periods.every((period) => period.completenessScore >= 60)) {
    return 'excellent';
  }
  if (fullMonths >= 1) {
    return 'good';
  }
  return 'limited';
}

export interface AggregateBaselineInput {
  sessionId: string;
  leadId: string | null;
  offerId: string | null;
  documents: BillingSourceDocument[];
  fields: ExtractedBillingField[];
  periods: BillingPeriodRecord[];
  confirmedByUserId: string;
  providerIds: string[];
  providerVersions: Record<string, string>;
  inputFingerprint: string;
  costLineItems?: BillingCostLineItem[];
  documentRotations?: Record<string, number>;
  selectedCandidateByFieldId?: Record<string, string>;
  pageExtractionMethods?: Record<string, 'embedded_text' | 'ocr' | 'mixed'>;
  meanOcrConfidence?: number | null;
}

export function aggregateCustomerCostBaseline(input: AggregateBaselineInput): CustomerCostBaseline {
  const included = input.periods.filter(
    (period) =>
      period.confirmationStatus === 'confirmed' && period.outlierDecision !== 'exclude',
  );

  const findings: BillingImportFinding[] = [];
  if (included.length === 0) {
    findings.push(
      createBillingFinding({
        code: BILLING_FINDING_CODES.BILLING_BASELINE_INCOMPLETE,
        severity: 'blocking',
        category: 'quality',
        documentId: null,
        fieldId: null,
        blocking: true,
        internalDescription: 'Keine bestätigte Periode für Aggregation vorhanden.',
        salesDescription: 'Es liegt keine bestätigte Abrechnungsperiode vor.',
        requiredAction: 'Mindestens eine Periode bestätigen',
      }),
    );
  }

  const currencies = new Set(included.map((period) => period.currency));
  if (currencies.size > 1) {
    findings.push(
      createBillingFinding({
        code: BILLING_FINDING_CODES.BILLING_CURRENCY_CONFLICT,
        severity: 'blocking',
        category: 'currency',
        documentId: null,
        fieldId: null,
        blocking: true,
        internalDescription: 'Mehrere Währungen in den Perioden.',
        salesDescription: 'Abrechnungen mit unterschiedlichen Währungen können nicht aggregiert werden.',
        requiredAction: 'Einheitliche Währung sicherstellen',
      }),
    );
  }

  const currency = included[0]?.currency ?? 'EUR';
  const weights = included.map((period) => ({
    weight: period.isFullMonth ? period.monthEquivalent : period.calendarDays / 30,
  }));

  const monthlyTotals = included
    .map((period, index) => {
      if (period.totalAmountCents === null) {
        return null;
      }
      return {
        value: normalizePeriodToMonthlyAmount(period.totalAmountCents, period),
        weight: weights[index]!.weight,
      };
    })
    .filter((entry): entry is { value: number; weight: number } => entry !== null);

  const totalVolume = included.reduce((sum, period) => sum + (period.cardVolumeCents ?? 0), 0);
  const totalTransactions = included.reduce(
    (sum, period) => sum + (period.transactionCount ?? 0),
    0,
  );

  const avgMonthlyTotal = weightedAverage(monthlyTotals);
  const monthlyTotalValues = monthlyTotals.map((entry) => entry.value);

  const snapshot: BillingImportSnapshot = {
    schemaVersion: BILLING_IMPORT_SNAPSHOT_SCHEMA_VERSION,
    engineVersion: BILLING_IMPORT_ENGINE_VERSION,
    providerIds: input.providerIds,
    providerVersions: input.providerVersions,
    documentFingerprints: Object.fromEntries(
      input.documents.map((document) => [document.id, document.contentFingerprint]),
    ),
    documents: input.documents,
    confirmedFields: input.fields.filter(
      (field) => field.status === 'confirmed' || field.status === 'corrected' || field.status === 'detected',
    ),
    correctedFields: input.fields.filter((field) => field.status === 'corrected'),
    rejectedFieldIds: input.fields.filter((field) => field.status === 'rejected').map((field) => field.id),
    manuallyAddedFields: input.fields.filter((field) => field.status === 'manually_added'),
    periods: input.periods,
    baselineSummary: {
      avgMonthlyCardVolumeCents:
        totalVolume > 0
          ? Math.round(
              weightedAverage(
                included
                  .filter((period) => period.cardVolumeCents !== null)
                  .map((period) => ({
                    value: normalizePeriodToMonthlyAmount(period.cardVolumeCents!, period),
                    weight: period.monthEquivalent,
                  })),
              ) ?? 0,
            )
          : null,
      avgMonthlyTransactionCount:
        totalTransactions > 0
          ? Math.round(
              weightedAverage(
                included
                  .filter((period) => period.transactionCount !== null)
                  .map((period) => ({
                    value: normalizePeriodToMonthlyAmount(period.transactionCount!, period),
                    weight: period.monthEquivalent,
                  })),
              ) ?? 0,
            )
          : null,
      avgTicketCents:
        totalTransactions > 0 && totalVolume > 0
          ? Math.round(totalVolume / totalTransactions)
          : null,
      avgMonthlyFixedCostsCents: weightedAverage(
        included
          .filter((period) => period.fixedCostsCents !== null)
          .map((period) => ({
            value: normalizePeriodToMonthlyAmount(period.fixedCostsCents!, period),
            weight: period.monthEquivalent,
          })),
      ),
      avgMonthlyTerminalCostsCents: weightedAverage(
        included
          .filter((period) => period.terminalCostsCents !== null)
          .map((period) => ({
            value: normalizePeriodToMonthlyAmount(period.terminalCostsCents!, period),
            weight: period.monthEquivalent,
          })),
      ),
      avgMonthlyTransactionCostsCents: weightedAverage(
        included
          .filter((period) => period.transactionCostsCents !== null)
          .map((period) => ({
            value: normalizePeriodToMonthlyAmount(period.transactionCostsCents!, period),
            weight: period.monthEquivalent,
          })),
      ),
      avgMonthlyVolumeBasedCostsCents: weightedAverage(
        included
          .filter((period) => period.volumeBasedCostsCents !== null)
          .map((period) => ({
            value: normalizePeriodToMonthlyAmount(period.volumeBasedCostsCents!, period),
            weight: period.monthEquivalent,
          })),
      ),
      avgMonthlyTotalCostsCents: avgMonthlyTotal,
      totalOneTimeCostsCents: included.reduce(
        (sum, period) => sum + Math.abs(period.oneTimeCostsCents ?? 0),
        0,
      ),
      costPerTransactionCents:
        totalTransactions > 0 && avgMonthlyTotal !== null
          ? Math.round(
              (included.reduce((sum, period) => sum + (period.transactionCostsCents ?? 0), 0) /
                totalTransactions),
            )
          : null,
      qualityStatus: assessBaselineQuality(included, findings),
      currency,
      netGrossBasis: 'unknown',
    },
    aggregationRulesVersion: '1.0.0',
    excludedPeriodIds: input.periods
      .filter((period) => period.confirmationStatus === 'excluded')
      .map((period) => period.id),
    outlierDecisions: Object.fromEntries(
      included.map((period) => [period.id, period.outlierDecision]),
    ),
    findings,
    confirmedAt: new Date().toISOString(),
    confirmedByUserId: input.confirmedByUserId,
    ocrLanguageModel: BILLING_OCR_CONFIG.languages,
    preprocessingProfile: 'grayscale_contrast_scale',
    documentRotations: input.documentRotations ?? {},
    selectedCandidateByFieldId: input.selectedCandidateByFieldId ?? {},
    manualCostLineItems: input.costLineItems ?? [],
    pageExtractionMethods: input.pageExtractionMethods ?? {},
    meanOcrConfidence: input.meanOcrConfidence ?? null,
  };

  findings.push(
    createBillingFinding({
      code: BILLING_FINDING_CODES.BILLING_ORIGINAL_DOCUMENT_NOT_PERSISTED,
      severity: 'info',
      category: 'storage',
      documentId: null,
      fieldId: null,
      blocking: false,
      internalDescription: 'Originaldateien werden nur temporär während der Sitzung gehalten.',
      salesDescription:
        'Originalabrechnungen werden nicht dauerhaft gespeichert. Nach einem Reload können Dokumente erneut hochgeladen werden müssen.',
      requiredAction: null,
    }),
  );

  const qualityStatus = assessBaselineQuality(included, findings);
  const now = new Date().toISOString();

  return {
    id: generateId('cost_baseline'),
    leadId: input.leadId,
    offerId: input.offerId,
    billingImportSessionId: input.sessionId,
    version: 1,
    status: findings.some((finding) => finding.blocking) ? 'draft' : 'confirmed',
    engineVersion: BILLING_IMPORT_ENGINE_VERSION,
    documentCount: input.documents.length,
    confirmedPeriodCount: included.length,
    fullMonthCount: included.filter((period) => period.isFullMonth).length,
    coverageFrom: included.length > 0 ? included.map((p) => p.periodFrom).sort()[0]! : null,
    coverageTo: included.length > 0 ? included.map((p) => p.periodTo).sort().slice(-1)[0]! : null,
    currency,
    netGrossBasis: 'unknown',
    avgMonthlyCardVolumeCents: snapshot.baselineSummary.avgMonthlyCardVolumeCents,
    avgMonthlyTransactionCount: snapshot.baselineSummary.avgMonthlyTransactionCount,
    avgTicketCents: snapshot.baselineSummary.avgTicketCents,
    avgMonthlyFixedCostsCents: snapshot.baselineSummary.avgMonthlyFixedCostsCents,
    avgMonthlyTerminalCostsCents: snapshot.baselineSummary.avgMonthlyTerminalCostsCents,
    avgMonthlyTransactionCostsCents: snapshot.baselineSummary.avgMonthlyTransactionCostsCents,
    avgMonthlyVolumeBasedCostsCents: snapshot.baselineSummary.avgMonthlyVolumeBasedCostsCents,
    avgMonthlyClearingCostsCents: weightedAverage(
      included
        .filter((period) => period.clearingCostsCents !== null)
        .map((period) => ({
          value: normalizePeriodToMonthlyAmount(period.clearingCostsCents!, period),
          weight: period.monthEquivalent,
        })),
    ),
    avgMonthlyServiceCostsCents: weightedAverage(
      included
        .filter((period) => period.serviceCostsCents !== null)
        .map((period) => ({
          value: normalizePeriodToMonthlyAmount(period.serviceCostsCents!, period),
          weight: period.monthEquivalent,
        })),
    ),
    avgMonthlyOtherRecurringCostsCents: null,
    avgMonthlyTotalCostsCents: snapshot.baselineSummary.avgMonthlyTotalCostsCents,
    totalOneTimeCostsCents: snapshot.baselineSummary.totalOneTimeCostsCents,
    costPerTransactionCents: snapshot.baselineSummary.costPerTransactionCents,
    minMonthlyTotalCents: monthlyTotalValues.length > 0 ? Math.min(...monthlyTotalValues) : null,
    maxMonthlyTotalCents: monthlyTotalValues.length > 0 ? Math.max(...monthlyTotalValues) : null,
    medianMonthlyTotalCents: median(monthlyTotalValues),
    costSpreadCents:
      monthlyTotalValues.length > 0
        ? Math.max(...monthlyTotalValues) - Math.min(...monthlyTotalValues)
        : null,
    cardMixGirocardPercent: null,
    cardMixCreditPercent: null,
    qualityStatus,
    includedPeriodIds: included.map((period) => period.id),
    excludedPeriodIds: snapshot.excludedPeriodIds,
    findings,
    inputFingerprint: input.inputFingerprint,
    snapshot,
    confirmedByUserId: input.confirmedByUserId,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
