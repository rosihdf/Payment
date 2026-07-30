import type { BillingCostLineItem } from './billingCostLineItem';
import type { BillingImportFinding } from './billingImportFinding';
import type { BillingPeriodRecord } from './billingPeriodRecord';
import type { BillingSourceDocument } from './billingSourceDocument';
import type { ExtractedBillingField } from './extractedBillingField';
import type { CustomerCostBaseline } from './customerCostBaseline';

export interface BillingImportSnapshot {
  schemaVersion: number;
  engineVersion: string;
  providerIds: string[];
  providerVersions: Record<string, string>;
  documentFingerprints: Record<string, string>;
  documents: BillingSourceDocument[];
  confirmedFields: ExtractedBillingField[];
  correctedFields: ExtractedBillingField[];
  rejectedFieldIds: string[];
  manuallyAddedFields: ExtractedBillingField[];
  periods: BillingPeriodRecord[];
  baselineSummary: Pick<
    CustomerCostBaseline,
    | 'avgMonthlyCardVolumeCents'
    | 'avgMonthlyTransactionCount'
    | 'avgTicketCents'
    | 'avgMonthlyFixedCostsCents'
    | 'avgMonthlyTerminalCostsCents'
    | 'avgMonthlyTransactionCostsCents'
    | 'avgMonthlyVolumeBasedCostsCents'
    | 'avgMonthlyTotalCostsCents'
    | 'totalOneTimeCostsCents'
    | 'costPerTransactionCents'
    | 'qualityStatus'
    | 'currency'
    | 'netGrossBasis'
  >;
  aggregationRulesVersion: string;
  excludedPeriodIds: string[];
  outlierDecisions: Record<string, string>;
  findings: BillingImportFinding[];
  confirmedAt: string;
  confirmedByUserId: string;
  ocrLanguageModel?: string;
  preprocessingProfile?: string;
  documentRotations?: Record<string, number>;
  selectedCandidateByFieldId?: Record<string, string>;
  manualCostLineItems?: BillingCostLineItem[];
  pageExtractionMethods?: Record<string, 'embedded_text' | 'ocr' | 'mixed'>;
  meanOcrConfidence?: number | null;
}

export const BILLING_IMPORT_SNAPSHOT_SCHEMA_VERSION = 2;
