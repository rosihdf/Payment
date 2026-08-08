import type { CommissionCalculationInput } from '../commission/commissionCalculationInput';
import type { CommissionContractConfiguration } from '../commission/commissionContractConfiguration';
import {
  resolveCommissionContractConfiguration,
  resolveCommissionContractConfigurationFromCandidate,
} from '../commission/commissionContractConfiguration';
import type { PricingEvaluationResult } from '../pricing/pricingEvaluation';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import type { CustomerNeed } from '../recommendation/customerNeed';

export function buildCommissionCalculationInputFromCandidate(
  need: CustomerNeed,
  candidate: BestPaySolutionCandidate,
  pricingEvaluationResult: PricingEvaluationResult,
  options: {
    contractConfiguration?: CommissionContractConfiguration | null;
    contractTypeCode?: string | null;
  } = {},
): CommissionCalculationInput {
  const termMonths = pricingEvaluationResult.termMonths;
  const contractConfiguration =
    options.contractConfiguration ??
    resolveCommissionContractConfigurationFromCandidate({
      hardwareProductIds: candidate.hardwareProductIds,
      termMonths,
    }) ??
    resolveCommissionContractConfiguration({
      contractTypeCode: options.contractTypeCode ?? null,
      termMonths,
    });

  const contractTypeCode = options.contractTypeCode ?? null;

  return {
    evaluationDate: need.evaluationDate,
    offerId: need.offerId ?? `recommendation_preview_${candidate.candidateId}`,
    offerVersionKey: `preview:${candidate.candidateId}:${pricingEvaluationResult.inputFingerprint}`,
    salesRepresentativeId: need.salesRepresentativeId,
    pricingEvaluationRecordId: `preview_${candidate.candidateId}`,
    pricingEvaluationResult,
    contractConfiguration,
    contractTypeCode,
    accessoryItems: candidate.accessoryItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      salePriceCents: null,
    })),
  };
}
