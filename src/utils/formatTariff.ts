import type { CardRate } from '../domain/tariff/tariff';
import { formatCentsToCurrency } from './currency';
import { formatBasisPointsToPercent } from './percentage';

export function formatCardRate(rate: CardRate): string {
  if (rate.percentageBasisPoints === 0 && rate.fixedFeeCents === 0) {
    return 'Kostenfrei';
  }

  const parts: string[] = [];

  if (rate.percentageBasisPoints > 0) {
    parts.push(formatBasisPointsToPercent(rate.percentageBasisPoints));
  }

  if (rate.fixedFeeCents > 0) {
    parts.push(formatCentsToCurrency(rate.fixedFeeCents));
  }

  return parts.length > 0 ? parts.join(' + ') : 'Kostenfrei';
}

export function formatValidityRange(validFrom: string | null, validUntil: string | null): string {
  if (!validFrom && !validUntil) {
    return 'Unbegrenzt';
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
