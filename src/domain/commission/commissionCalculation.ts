import type { CommissionFinding } from './commissionFinding';
import type { CommissionReductionDecision } from './commissionReduction';
import type { CommissionSnapshot } from './commissionSnapshot';

export type CommissionCalculationStatus =
  | 'preview'
  | 'complete'
  | 'incomplete'
  | 'blocked'
  | 'frozen';

export type CommissionCalculationRecordStatus = 'preview' | 'frozen' | 'superseded';

export interface CommissionComponent {
  id: string;
  commissionRuleId: string | null;
  commissionType: import('./commissionRule').CommissionType;
  label: string;
  calculationBasis: import('./commissionRule').CommissionCalculationBasis;
  basisValueCents: number | null;
  basisValueTenthsOfCent: number | null;
  thresholdTenthsOfCent: number | null;
  percentTenthsOfBasisPoint: number | null;
  quantity: number;
  unitAmountCents: number | null;
  totalAmountCents: number;
  currency: string;
  isProvisional: boolean;
  isCalculable: boolean;
  missingDataRequirement: string | null;
  isPositive: boolean;
  internalExplanation: string;
  sortOrder: number;
}

export interface CommissionCalculationResult {
  calculationId: string;
  engineVersion: string;
  calculatedAt: string;
  evaluationDate: string;
  offerId: string;
  offerVersionKey: string;
  pricingEvaluationRecordId: string;
  pricingEvaluationId: string;
  salesRepresentativeId: string;
  assignmentId: string | null;
  commissionPlanId: string | null;
  commissionPlanVersionId: string | null;
  commissionPlanVersionNumber: number | null;
  components: CommissionComponent[];
  rejectedRules: Array<{ id: string; name: string; reason: string }>;
  baseCommissionAmountCents: number;
  provisionalRecurringAmountCents: number;
  confirmedRecurringAmountCents: number;
  accessoryCommissionAmountCents: number;
  bonusAmountCents: number;
  malusAmountCents: number;
  originalCommissionAmountCents: number;
  proposedReductionAmountCents: number;
  approvedReductionAmountCents: number;
  correctionAmountCents: number;
  finalExpectedCommissionAmountCents: number;
  currency: string;
  status: CommissionCalculationStatus;
  adminReviewRequired: boolean;
  reductionReviewRequired: boolean;
  canFreeze: boolean;
  calculationBlocked: boolean;
  requiredJustifications: string[];
  findings: CommissionFinding[];
  reductionDecision: CommissionReductionDecision | null;
  snapshot: CommissionSnapshot;
  stale: boolean;
}

export const COMMISSION_ENGINE_VERSION = '1.0.0';
export const COMMISSION_SNAPSHOT_SCHEMA_VERSION = 1;

export interface CommissionCalculationRecord {
  id: string;
  offerId: string;
  status: CommissionCalculationRecordStatus;
  inputFingerprint: string;
  result: CommissionCalculationResult;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}
