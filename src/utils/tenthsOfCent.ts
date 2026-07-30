import type { TenthsOfCent } from '../domain/calculator/comparison';

const preciseCurrencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export function centsToTenthsOfCent(cents: number): TenthsOfCent {
  return Math.max(0, Math.round(cents * 10));
}

export function tenthsOfCentToCents(tenths: TenthsOfCent): number {
  return Math.round(tenths / 10);
}

export function formatTenthsOfCentToCurrency(tenths: TenthsOfCent): string {
  return preciseCurrencyFormatter.format(tenths / 1000);
}

export function parseCurrencyToTenthsOfCent(input: string): number | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(normalized);

  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 1000);
}

export function transactionCostsFromTenthsOfCent(
  transactionCount: number,
  feeTenthsOfCent: TenthsOfCent,
): number {
  return Math.round((transactionCount * feeTenthsOfCent) / 10);
}
