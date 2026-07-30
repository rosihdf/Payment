import type { CommissionCalculationInput } from '../commission/commissionCalculationInput';
import type { PricingEvaluationResult } from '../pricing/pricingEvaluation';
import { PRICING_FINDING_CODES } from '../pricing/pricingFinding';
import type { Offer } from '../offer/offer';

export function createOfferVersionKey(offer: Offer): string {
  return `${offer.id}:${offer.updatedAt}`;
}

export function buildCommissionCalculationInput(
  offer: Offer,
  pricingEvaluationRecordId: string,
  pricingEvaluationResult: PricingEvaluationResult,
  contractTypeCode: string | null,
  evaluationDate?: string,
): CommissionCalculationInput {
  const accessoryItems = offer.items
    .filter((item) => item.productSnapshot?.category === 'accessory')
    .map((item) => ({
      productId: item.productSnapshot!.productId,
      quantity: item.quantity,
      salePriceCents: item.unitPriceCents,
    }));

  return {
    evaluationDate: evaluationDate ?? new Date().toISOString().slice(0, 10),
    offerId: offer.id,
    offerVersionKey: createOfferVersionKey(offer),
    salesRepresentativeId: offer.createdByUserId,
    pricingEvaluationRecordId,
    pricingEvaluationResult,
    contractTypeCode,
    accessoryItems,
  };
}

export function pricingEvaluationBlocksCommission(pricing: PricingEvaluationResult): boolean {
  return (
    pricing.stale ||
    pricing.approval.approvalBlocked ||
    pricing.findings.some((finding) => finding.blocking)
  );
}

export function pricingHasTermAmbiguity36(pricing: PricingEvaluationResult): boolean {
  return pricing.findings.some(
    (finding) => finding.code === PRICING_FINDING_CODES.PROVISION_TERM_AMBIGUOUS_36_MONTHS,
  );
}

export function pricingRequiresReductionReview(pricing: PricingEvaluationResult): boolean {
  return pricing.findings.some(
    (finding) =>
      finding.code === PRICING_FINDING_CODES.PRICE_BELOW_TARGET ||
      finding.code === PRICING_FINDING_CODES.PRICE_BELOW_MINIMUM ||
      finding.code === PRICING_FINDING_CODES.DISCOUNT_LIMIT_EXCEEDED,
  );
}
