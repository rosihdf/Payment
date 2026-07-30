import type { BillingImportFinding } from './billingImportFinding';

export type BillingPeriodQualityStatus = 'excellent' | 'good' | 'limited' | 'poor' | 'unusable';

export type BillingPeriodConfirmationStatus = 'draft' | 'confirmed' | 'excluded';

export type BillingOutlierDecision = 'include' | 'exclude' | 'one_time_only' | 'pending';

export interface BillingPeriodCardMix {
  girocardPercent: number | null;
  creditPercent: number | null;
  debitPercent: number | null;
}

export interface BillingPeriodRecord {
  id: string;
  sessionId: string;
  sourceDocumentIds: string[];
  periodFrom: string;
  periodTo: string;
  calendarDays: number;
  isFullMonth: boolean;
  isPartialPeriod: boolean;
  monthEquivalent: number;
  currency: string;
  netGrossBasis: 'net' | 'gross' | 'unknown';

  cardVolumeCents: number | null;
  transactionCount: number | null;
  averageTicketCents: number | null;

  fixedCostsCents: number | null;
  terminalCostsCents: number | null;
  transactionCostsCents: number | null;
  volumeBasedCostsCents: number | null;
  clearingCostsCents: number | null;
  serviceCostsCents: number | null;
  otherRecurringCostsCents: number | null;
  oneTimeCostsCents: number | null;
  creditAmountCents: number | null;
  taxAmountCents: number | null;
  totalAmountCents: number | null;

  terminalCount: number | null;
  cardMix: BillingPeriodCardMix;

  completenessScore: number;
  qualityStatus: BillingPeriodQualityStatus;
  outlierStatus: 'none' | 'detected' | 'confirmed';
  outlierDecision: BillingOutlierDecision;
  confirmationStatus: BillingPeriodConfirmationStatus;
  findings: BillingImportFinding[];
}
