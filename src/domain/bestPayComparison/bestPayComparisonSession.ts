import type { SalesWizardState } from './salesWizard';
import { DEFAULT_SALES_WIZARD_STATE } from './salesWizard';

export type BestPayComparisonStatus =
  | 'draft'
  | 'billing_import'
  | 'review_required'
  | 'ready_for_calculation'
  | 'calculated'
  | 'recommendation_selected'
  | 'assigned'
  | 'offer_created'
  | 'discarded';

export type BestPayComparisonSource = 'billing_import' | 'manual' | 'mixed';

export type BestPayComparisonEntryMode = 'calculator' | 'wizard';

export interface BestPayManualInput {
  monthlyCardVolumeCents: number | null;
  annualCardVolumeCents: number | null;
  monthlyTransactions: number | null;
  averageTransactionValueCents: number | null;
  girocardPercent: number | null;
  debitPercent: number | null;
  creditPercent: number | null;
  otherPercent: number | null;
  monthlyFixedCostsCents: number | null;
  monthlyTerminalCostsCents: number | null;
  monthlyTransactionCostsCents: number | null;
  monthlyClearingCostsCents: number | null;
  monthlyTotalCostsCents: number | null;
  terminalCount: number;
  paymentUsage: {
    stationary: boolean;
    mobile: boolean;
    ecommerce: boolean;
    softPos: boolean;
  };
  preferredTermMonths: number | null;
  industry: string;
}

export interface BestPayComparisonVariantSummary {
  candidateId: string;
  tariffId: string;
  tariffName: string;
  productId: string | null;
  productName: string | null;
  termMonths: number | null;
  monthlyTotalCostsCents: number | null;
  annualTotalCostsCents: number | null;
  oneTimeCostsCents: number | null;
  savingsMonthlyCents: number | null;
  savingsAnnualCents: number | null;
  savingsPercent: number | null;
  isHigherCost: boolean;
  commissionTotalCents: number | null;
  score: number | null;
  rank: number | null;
  primaryReasons: string[];
}

export interface BestPayComparisonResultSummary {
  recommendationRecordId: string | null;
  recommendationVersion: number | null;
  primaryCandidateId: string | null;
  variants: BestPayComparisonVariantSummary[];
  currentMonthlyCostsCents: number | null;
  currentAnnualCostsCents: number | null;
  inputFingerprint: string | null;
  calculatedAt: string | null;
  stale: boolean;
  staleReasons: string[];
}

export interface BestPayComparisonSession {
  id: string;
  schemaVersion: number;
  status: BestPayComparisonStatus;
  source: BestPayComparisonSource | null;
  entryMode: BestPayComparisonEntryMode;
  title: string | null;
  leadId: string | null;
  customerLabel: string | null;
  leadDisplayName: string | null;
  billingImportSessionId: string | null;
  costBaselineId: string | null;
  costBaselineVersion: number | null;
  manualInput: BestPayManualInput;
  result: BestPayComparisonResultSummary | null;
  selectedCandidateId: string | null;
  offerId: string | null;
  offerNumber: string | null;
  offerTitle: string | null;
  offerCreationToken: string | null;
  duplicateOfSessionId: string | null;
  wizard: SalesWizardState;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  discardedAt: string | null;
}

/** B01 Session-Schema (A11.5 v2 wird migriert). */
export const BESTPAY_COMPARISON_SCHEMA_VERSION = 3;

export { DEFAULT_SALES_WIZARD_STATE };

export const DEFAULT_BESTPAY_MANUAL_INPUT: BestPayManualInput = {
  monthlyCardVolumeCents: null,
  annualCardVolumeCents: null,
  monthlyTransactions: null,
  averageTransactionValueCents: null,
  girocardPercent: null,
  debitPercent: null,
  creditPercent: null,
  otherPercent: null,
  monthlyFixedCostsCents: null,
  monthlyTerminalCostsCents: null,
  monthlyTransactionCostsCents: null,
  monthlyClearingCostsCents: null,
  monthlyTotalCostsCents: null,
  terminalCount: 1,
  paymentUsage: {
    stationary: false,
    mobile: true,
    ecommerce: false,
    softPos: false,
  },
  preferredTermMonths: 36,
  industry: '',
};
