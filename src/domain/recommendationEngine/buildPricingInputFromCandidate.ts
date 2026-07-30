import type { PricingEvaluationInput } from '../pricing/pricingEvaluation';
import { normalizePricingEvaluationInput } from '../pricing/pricingEvaluationDefaults';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import type { Tariff } from '../tariff/tariff';
import type { Product } from '../product/product';

export function buildPricingEvaluationInputFromCandidate(
  need: CustomerNeed,
  candidate: BestPaySolutionCandidate,
  tariffs: Map<string, Tariff>,
  products: Map<string, Product>,
): PricingEvaluationInput {
  const tariff = tariffs.get(candidate.tariffId);
  let requestedMonthlyCents = 0;
  let requestedOneTimeCents = 0;

  if (tariff) {
    requestedMonthlyCents =
      (tariff.monthlyAccountBaseFeeCents +
        tariff.monthlyTerminalRentalCents +
        tariff.monthlyServiceFeePerTerminalCents) *
      candidate.quantity;
    requestedOneTimeCents = tariff.setupFeeCents;
  }

  for (const productId of candidate.hardwareProductIds) {
    const product = products.get(productId);
    if (!product || product.priceCents === null) {
      continue;
    }

    if (product.priceType === 'monthly') {
      requestedMonthlyCents += product.priceCents * candidate.quantity;
    } else if (product.priceType === 'one_time') {
      requestedOneTimeCents += product.priceCents * candidate.quantity;
    }
  }

  return normalizePricingEvaluationInput({
    evaluationDate: need.evaluationDate,
    salesRepresentativeId: need.salesRepresentativeId,
    leadId: need.leadId,
    offerId: need.offerId,
    currency: 'EUR',
    contractTypeId: candidate.contractTypeId,
    productId: candidate.hardwareProductIds[0] ?? null,
    tariffId: candidate.tariffId,
    hardwareProductIds: candidate.hardwareProductIds,
    accessoryItems: candidate.accessoryItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      requestedUnitPriceCents: null,
    })),
    contractTermId: candidate.contractTermId,
    requestedSpecialTermMonths: candidate.isStandardTerm ? null : candidate.contractTermMonths,
    specialTermReason: '',
    quantity: candidate.quantity,
    annualCardVolumeCents: need.annualCardVolumeCents,
    monthlyCardVolumeCents: need.monthlyCardVolumeCents,
    transactionCount: need.monthlyTransactions,
    averageTicketCents: need.averageTransactionValueCents,
    girocardSharePercent: need.cardMix.girocardPercent,
    creditCardSharePercent: need.cardMix.creditPercent,
    requestedUnitPriceCents: requestedMonthlyCents,
    requestedTotalPriceCents: requestedMonthlyCents + requestedOneTimeCents,
    manualPriceOverride: false,
    overrideReason: '',
  });
}
