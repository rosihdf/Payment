import type { ProductPriceType } from '../domain/product/product';
import { formatCentsToCurrency } from './currency';
import { PRODUCT_PRICE_TYPE_LABELS } from '../domain/product/product';

export function formatProductPrice(
  priceType: ProductPriceType,
  priceCents: number | null,
): string {
  if (priceType === 'on_request') {
    return 'Preis auf Anfrage';
  }

  if (priceType === 'included') {
    return 'inklusive';
  }

  if (priceCents === null) {
    return '—';
  }

  const amount = formatCentsToCurrency(priceCents);

  if (priceType === 'monthly') {
    return `${amount} / Monat`;
  }

  return `${amount} einmalig`;
}

export function formatProductPriceShort(
  priceType: ProductPriceType,
  priceCents: number | null,
): string {
  if (priceType === 'on_request') {
    return PRODUCT_PRICE_TYPE_LABELS.on_request;
  }

  if (priceType === 'included') {
    return PRODUCT_PRICE_TYPE_LABELS.included;
  }

  if (priceCents === null) {
    return '—';
  }

  return formatCentsToCurrency(priceCents);
}

export function formatProductPriceTypeLabel(priceType: ProductPriceType): string {
  return PRODUCT_PRICE_TYPE_LABELS[priceType];
}
