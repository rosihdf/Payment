import type { PricingEvaluationResult } from '../pricing/pricingEvaluation';
import type { CommissionContractConfiguration } from './commissionContractConfiguration';

export interface CommissionCalculationInput {
  evaluationDate: string;
  offerId: string;
  offerVersionKey: string;
  salesRepresentativeId: string;
  pricingEvaluationRecordId: string;
  pricingEvaluationResult: PricingEvaluationResult;
  /** Explizite PPT-Vertragskonstellation – keine Addition Terminal + ACQ. */
  contractConfiguration: CommissionContractConfiguration | null;
  /** @deprecated Legacy – nutze contractConfiguration. */
  contractTypeCode: string | null;
  accessoryItems: Array<{
    productId: string;
    quantity: number;
    salePriceCents: number | null;
  }>;
}

import type { CommissionRuleOverride } from './commissionRuleOverride';

export interface CommissionCalculationContext {
  commissionPlanVersions: import('./commissionPlan').CommissionPlanVersion[];
  commissionPlans: import('./commissionPlan').CommissionPlan[];
  commissionRules: import('./commissionRule').CommissionRule[];
  assignments: import('./commissionAssignment').SalesRepresentativeCommissionAssignment[];
  ruleOverrides?: CommissionRuleOverride[];
}
