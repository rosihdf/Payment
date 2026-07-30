import type { BillingImportFinding } from './billingImportFinding';
import type { BillingPeriodQualityStatus } from './billingPeriodRecord';
import type { BillingImportSnapshot } from './billingImportSnapshot';

export type CustomerCostBaselineStatus = 'draft' | 'confirmed' | 'frozen' | 'stale' | 'superseded';

export interface CustomerCostBaseline {
  id: string;
  leadId: string | null;
  offerId: string | null;
  billingImportSessionId: string;
  version: number;
  status: CustomerCostBaselineStatus;
  engineVersion: string;

  documentCount: number;
  confirmedPeriodCount: number;
  fullMonthCount: number;
  coverageFrom: string | null;
  coverageTo: string | null;
  currency: string;
  netGrossBasis: 'net' | 'gross' | 'unknown';

  avgMonthlyCardVolumeCents: number | null;
  avgMonthlyTransactionCount: number | null;
  avgTicketCents: number | null;
  avgMonthlyFixedCostsCents: number | null;
  avgMonthlyTerminalCostsCents: number | null;
  avgMonthlyTransactionCostsCents: number | null;
  avgMonthlyVolumeBasedCostsCents: number | null;
  avgMonthlyClearingCostsCents: number | null;
  avgMonthlyServiceCostsCents: number | null;
  avgMonthlyOtherRecurringCostsCents: number | null;
  avgMonthlyTotalCostsCents: number | null;
  totalOneTimeCostsCents: number | null;
  costPerTransactionCents: number | null;

  minMonthlyTotalCents: number | null;
  maxMonthlyTotalCents: number | null;
  medianMonthlyTotalCents: number | null;
  costSpreadCents: number | null;

  cardMixGirocardPercent: number | null;
  cardMixCreditPercent: number | null;

  qualityStatus: BillingPeriodQualityStatus;
  includedPeriodIds: string[];
  excludedPeriodIds: string[];
  findings: BillingImportFinding[];
  inputFingerprint: string;
  snapshot: BillingImportSnapshot;

  confirmedByUserId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
