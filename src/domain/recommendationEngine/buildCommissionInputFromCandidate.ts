import type { CommissionCalculationInput } from '../commission/commissionCalculationInput';
import type { PricingEvaluationResult } from '../pricing/pricingEvaluation';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import type { CustomerNeed } from '../recommendation/customerNeed';

export function buildCommissionCalculationInputFromCandidate(
  need: CustomerNeed,
  candidate: BestPaySolutionCandidate,
  pricingEvaluationResult: PricingEvaluationResult,
  contractTypeCode: string | null = null,
): CommissionCalculationInput {
  return {
    evaluationDate: need.evaluationDate,
    offerId: need.offerId ?? `recommendation_preview_${candidate.candidateId}`,
    offerVersionKey: `preview:${candidate.candidateId}:${pricingEvaluationResult.inputFingerprint}`,
    salesRepresentativeId: need.salesRepresentativeId,
    pricingEvaluationRecordId: `preview_${candidate.candidateId}`,
    pricingEvaluationResult,
    contractTypeCode,
    accessoryItems: candidate.accessoryItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      salePriceCents: null,
    })),
  };
}
