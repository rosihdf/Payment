import type { CommissionFinding } from './commissionFinding';
import type { CommissionComponent } from './commissionCalculation';
import type { CommissionReductionDecision } from './commissionReduction';
import type { PricingEvaluationSnapshot } from '../pricing/pricingEvaluation';

import type { CommissionContractConfiguration } from './commissionContractConfiguration';

export interface CommissionSnapshot {
  schemaVersion: number;
  engineVersion: string;
  calculatedAt: string;
  evaluationDate: string;
  offerId: string;
  offerVersionKey: string;
  pricingEvaluationRecordId: string;
  pricingEvaluationSnapshot: PricingEvaluationSnapshot;
  salesRepresentativeId: string;
  commissionPlanId: string | null;
  commissionPlanVersionId: string | null;
  commissionPlanVersionNumber: number | null;
  assignmentId: string | null;
  contractTypeCode: string | null;
  contractConfiguration: CommissionContractConfiguration | null;
  termMonths: number | null;
  appliedRuleIds: string[];
  rejectedRuleIds: string[];
  components: CommissionComponent[];
  originalCommissionAmountCents: number;
  proposedReductionAmountCents: number;
  approvedReductionAmountCents: number;
  finalExpectedCommissionAmountCents: number;
  currency: string;
  findings: CommissionFinding[];
  reductionDecision: CommissionReductionDecision | null;
}
