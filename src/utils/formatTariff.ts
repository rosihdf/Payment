import type { CardRate } from '../domain/tariff/tariff';
import { formatCentsToCurrency } from './currency';
import { formatTenthsOfBasisPointToPercent } from './percentage';
import { formatTenthsOfCentToCurrency } from './tenthsOfCent';

export function formatCardRate(rate: CardRate): string {
  if (rate.percentageTenthsOfBasisPoint === 0 && rate.fixedFeeTenthsOfCent === 0) {
    return 'Kostenfrei';
  }

  const parts: string[] = [];

  if (rate.percentageTenthsOfBasisPoint > 0) {
    parts.push(formatTenthsOfBasisPointToPercent(rate.percentageTenthsOfBasisPoint));
  }

  if (rate.fixedFeeTenthsOfCent > 0) {
    parts.push(formatTenthsOfCentToCurrency(rate.fixedFeeTenthsOfCent));
  }

  return parts.length > 0 ? parts.join(' + ') : 'Kostenfrei';
}

export function formatGirocardClearing(
  clearingIncluded: boolean,
  clearingFeeTenthsOfCent: number,
): string {
  if (clearingIncluded) {
    return 'inklusive';
  }

  if (clearingFeeTenthsOfCent === 0) {
    return formatTenthsOfCentToCurrency(0);
  }

  return formatTenthsOfCentToCurrency(clearingFeeTenthsOfCent);
}

export function formatOptionalMonths(value: number | null): string {
  if (value === null) {
    return 'Keine Angabe';
  }

  return `${value} Monate`;
}

export function formatOptionalTransactions(value: number | null): string {
  if (value === null) {
    return 'Keine Angabe';
  }

  return String(value);
}

export function formatOptionalCents(value: number | null): string {
  if (value === null) {
    return 'Keine Angabe';
  }

  return formatCentsToCurrency(value);
}

export function formatValidityRange(validFrom: string | null, validUntil: string | null): string {
  if (!validFrom && !validUntil) {
    return 'Keine Angabe';
  }

  const formatDate = (value: string): string => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
  };

  if (validFrom && validUntil) {
    return `${formatDate(validFrom)} – ${formatDate(validUntil)}`;
  }

  if (validFrom) {
    return `Ab ${formatDate(validFrom)}`;
  }

  return `Bis ${formatDate(validUntil!)}`;
}
