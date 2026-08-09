import type { Offer, OfferItem, OfferTariffSnapshot, OfferTotals } from './offer';
import { isFrozenCommercialSnapshot, type OfferCommercialSnapshot } from './offerCommercialSnapshot';

function isBillablePriceType(priceType: OfferItem['priceType']): boolean {
  return priceType === 'monthly' || priceType === 'one_time';
}

export function calculateItemLineTotalCents(item: OfferItem): number | null {
  if (item.priceType === 'included') {
    return 0;
  }

  if (item.priceType === 'on_request') {
    return null;
  }

  if (item.unitPriceCents === null) {
    return null;
  }

  return item.quantity * item.unitPriceCents;
}

export function calculateTariffMonthlyFixedTotalCents(
  tariffSnapshot: OfferTariffSnapshot | null,
): number {
  if (!tariffSnapshot) {
    return 0;
  }

  return (
    tariffSnapshot.monthlyAccountBaseFeeCents +
    tariffSnapshot.monthlyTerminalRentalCents +
    tariffSnapshot.monthlyServiceFeePerTerminalCents
  );
}

export function calculateTariffSetupTotalCents(tariffSnapshot: OfferTariffSnapshot | null): number {
  return tariffSnapshot?.setupFeeCents ?? 0;
}

export function calculateOfferTotals(
  offer: Pick<Offer, 'items' | 'tariffSnapshot'> & {
    commercialSnapshot?: OfferCommercialSnapshot | null;
  },
): OfferTotals {
  if (isFrozenCommercialSnapshot(offer.commercialSnapshot)) {
    const breakdown = offer.commercialSnapshot.projection.breakdown;
    const monthlyTotalCents = breakdown.monthlyTotalCents;
    const oneTimeTotalCents = breakdown.oneTimeTotalCents;

    return {
      monthlyItemsTotalCents: monthlyTotalCents,
      oneTimeItemsTotalCents: oneTimeTotalCents,
      tariffMonthlyFixedTotalCents: 0,
      tariffSetupTotalCents: 0,
      monthlyTotalCents,
      oneTimeTotalCents,
      hasOnRequestItems: offer.items.some((item) => item.priceType === 'on_request'),
      onRequestItemCount: offer.items.filter((item) => item.priceType === 'on_request').length,
    };
  }

  let monthlyItemsTotalCents = 0;
  let oneTimeItemsTotalCents = 0;
  let hasOnRequestItems = false;
  let onRequestItemCount = 0;

  for (const item of offer.items) {
    if (item.priceType === 'on_request') {
      hasOnRequestItems = true;
      onRequestItemCount += 1;
      continue;
    }

    const lineTotal = calculateItemLineTotalCents(item);
    if (lineTotal === null) {
      continue;
    }

    if (item.priceType === 'monthly') {
      monthlyItemsTotalCents += lineTotal;
    } else if (item.priceType === 'one_time') {
      oneTimeItemsTotalCents += lineTotal;
    }
  }

  const tariffMonthlyFixedTotalCents = calculateTariffMonthlyFixedTotalCents(offer.tariffSnapshot);
  const tariffSetupTotalCents = calculateTariffSetupTotalCents(offer.tariffSnapshot);

  return {
    monthlyItemsTotalCents,
    oneTimeItemsTotalCents,
    tariffMonthlyFixedTotalCents,
    tariffSetupTotalCents,
    monthlyTotalCents: monthlyItemsTotalCents + tariffMonthlyFixedTotalCents,
    oneTimeTotalCents: oneTimeItemsTotalCents + tariffSetupTotalCents,
    hasOnRequestItems,
    onRequestItemCount,
  };
}

export function isPriceOverridden(
  priceType: OfferItem['priceType'],
  unitPriceCents: number | null,
  originalUnitPriceCents: number | null,
): boolean {
  if (priceType === 'on_request') {
    return false;
  }

  if (priceType === 'included') {
    return false;
  }

  if (originalUnitPriceCents === null) {
    return false;
  }

  if (unitPriceCents === null) {
    return false;
  }

  return unitPriceCents !== originalUnitPriceCents;
}

export function resolveOriginalUnitPriceCents(
  priceType: OfferItem['priceType'],
  catalogUnitPriceCents: number | null,
): number | null {
  if (priceType === 'included') {
    return 0;
  }

  if (priceType === 'on_request') {
    return null;
  }

  return catalogUnitPriceCents;
}

export function isBillableOfferItem(item: OfferItem): boolean {
  return isBillablePriceType(item.priceType);
}
