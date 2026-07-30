import { calculateOfferTotals } from '../offer/offerCalculations';
import type { Offer } from '../offer/offer';
import type { ContractTerm } from './contractTerm';
import type { PricingEvaluationInput } from './pricingEvaluation';
import { normalizePricingEvaluationInput } from './pricingEvaluationDefaults';

function findMatchingStandardTerm(
  months: number,
  terms: ContractTerm[],
  evaluationDate: string,
): ContractTerm | null {
  const date = new Date(`${evaluationDate.slice(0, 10)}T00:00:00.000Z`);

  return (
    terms.find((term) => {
      if (term.months !== months || !term.isStandard || term.status !== 'active') {
        return false;
      }

      if (term.validFrom) {
        const from = new Date(`${term.validFrom.slice(0, 10)}T00:00:00.000Z`);
        if (date < from) {
          return false;
        }
      }

      if (term.validUntil) {
        const until = new Date(`${term.validUntil.slice(0, 10)}T00:00:00.000Z`);
        if (date > until) {
          return false;
        }
      }

      return true;
    }) ?? null
  );
}

function resolvePrimaryProductId(offer: Offer): string | null {
  const productItem = offer.items.find(
    (item) => item.type === 'product' && item.productSnapshot?.productId,
  );

  return productItem?.productSnapshot?.productId ?? null;
}

function resolveManualOverride(offer: Offer): { manualPriceOverride: boolean; overrideReason: string } {
  const overriddenItems = offer.items.filter((item) => item.priceOverridden);
  if (overriddenItems.length === 0) {
    return { manualPriceOverride: false, overrideReason: '' };
  }

  return {
    manualPriceOverride: true,
    overrideReason: overriddenItems
      .map((item) => item.priceOverrideReason.trim())
      .filter(Boolean)
      .join('; '),
  };
}

export function buildPricingEvaluationInputFromOffer(
  offer: Offer,
  contractTerms: ContractTerm[],
  overrides: Partial<PricingEvaluationInput> = {},
): PricingEvaluationInput {
  const evaluationDate = overrides.evaluationDate ?? new Date().toISOString().slice(0, 10);
  const totals = calculateOfferTotals(offer);
  const overrideInfo = resolveManualOverride(offer);
  const tariffMonths = offer.tariffSnapshot?.contractDurationMonths ?? null;

  let contractTermId: string | null = overrides.contractTermId ?? null;
  let requestedSpecialTermMonths: number | null = overrides.requestedSpecialTermMonths ?? null;
  let specialTermReason = overrides.specialTermReason ?? '';

  if (
    contractTermId === null &&
    requestedSpecialTermMonths === null &&
    tariffMonths !== null
  ) {
    const matchingTerm = findMatchingStandardTerm(tariffMonths, contractTerms, evaluationDate);
    if (matchingTerm) {
      contractTermId = matchingTerm.id;
    } else {
      requestedSpecialTermMonths = tariffMonths;
    }
  }

  const hardwareProductIds =
    overrides.hardwareProductIds ??
    offer.items
      .filter((item) => item.productSnapshot?.category === 'payment_terminal')
      .map((item) => item.productSnapshot!.productId);

  const accessoryItems =
    overrides.accessoryItems ??
    offer.items
      .filter((item) => item.productSnapshot?.category === 'accessory')
      .map((item) => ({
        productId: item.productSnapshot!.productId,
        quantity: item.quantity,
        requestedUnitPriceCents: item.unitPriceCents,
      }));

  return normalizePricingEvaluationInput({
    evaluationDate,
    salesRepresentativeId: offer.createdByUserId,
    leadId: offer.leadId,
    offerId: offer.id,
    currency: 'EUR',
    contractTypeId: overrides.contractTypeId ?? null,
    productId: overrides.productId ?? resolvePrimaryProductId(offer),
    tariffId: overrides.tariffId ?? offer.tariffSnapshot?.tariffId ?? null,
    hardwareProductIds,
    accessoryItems,
    contractTermId,
    requestedSpecialTermMonths,
    specialTermReason,
    quantity: overrides.quantity ?? 1,
    requestedTotalPriceCents:
      overrides.requestedTotalPriceCents ?? totals.monthlyTotalCents + totals.oneTimeTotalCents,
    requestedUnitPriceCents: overrides.requestedUnitPriceCents ?? totals.monthlyTotalCents,
    manualPriceOverride: overrides.manualPriceOverride ?? overrideInfo.manualPriceOverride,
    overrideReason: overrides.overrideReason ?? overrideInfo.overrideReason,
    ...overrides,
  });
}
