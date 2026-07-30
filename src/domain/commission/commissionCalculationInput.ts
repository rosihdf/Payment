import type { PricingEvaluationResult } from '../pricing/pricingEvaluation';

export interface CommissionCalculationInput {
  evaluationDate: string;
  offerId: string;
  offerVersionKey: string;
  salesRepresentativeId: string;
  pricingEvaluationRecordId: string;
  pricingEvaluationResult: PricingEvaluationResult;
  contractTypeCode: string | null;
  accessoryItems: Array<{
    productId: string;
    quantity: number;
    salePriceCents: number | null;
  }>;
}

export interface CommissionCalculationContext {
  commissionPlanVersions: import('./commissionPlan').CommissionPlanVersion[];
  commissionPlans: import('./commissionPlan').CommissionPlan[];
  commissionRules: import('./commissionRule').CommissionRule[];
  assignments: import('./commissionAssignment').SalesRepresentativeCommissionAssignment[];
}
