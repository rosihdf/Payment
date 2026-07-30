import type { OfferItem, OfferItemPriceType } from '../domain/offer/offer';
import { calculateItemLineTotalCents } from '../domain/offer/offerCalculations';
import { formatCentsToCurrency } from './currency';
import { formatProductPrice, formatProductPriceTypeLabel } from './formatProduct';

export function formatOfferItemPrice(
  priceType: OfferItemPriceType,
  priceCents: number | null,
): string {
  return formatProductPrice(priceType, priceCents);
}

export function formatOfferItemPriceTypeLabel(priceType: OfferItemPriceType): string {
  return formatProductPriceTypeLabel(priceType);
}

export function formatOfferLineTotal(
  item: Pick<OfferItem, 'quantity' | 'priceType' | 'unitPriceCents'>,
): string {
  const lineTotal = calculateItemLineTotalCents(item as OfferItem);

  if (item.priceType === 'on_request') {
    return 'Preis auf Anfrage';
  }

  if (item.priceType === 'included') {
    return 'inklusive';
  }

  if (lineTotal === null) {
    return '—';
  }

  const amount = formatCentsToCurrency(lineTotal);

  if (item.priceType === 'monthly') {
    return `${amount} / Monat`;
  }

  return `${amount} einmalig`;
}

export function formatOfferQuantityPrice(
  item: Pick<OfferItem, 'quantity' | 'priceType' | 'unitPriceCents'>,
): string {
  if (item.priceType === 'on_request') {
    return 'Preis auf Anfrage';
  }

  if (item.priceType === 'included') {
    return 'inklusive';
  }

  if (item.unitPriceCents === null) {
    return '—';
  }

  const unit = formatCentsToCurrency(item.unitPriceCents);
  const line = formatOfferLineTotal(item);
  return `${item.quantity} × ${unit} = ${line}`;
}

export function formatOfferTotalCents(cents: number): string {
  return formatCentsToCurrency(cents);
}

export function formatOfferMonthlyTotal(cents: number): string {
  return `${formatCentsToCurrency(cents)} / Monat`;
}

export function formatOfferOneTimeTotal(cents: number): string {
  return `${formatCentsToCurrency(cents)} einmalig`;
}
