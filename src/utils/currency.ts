const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function formatCentsToCurrency(cents: number | null): string {
  if (cents === null) {
    return '';
  }

  return currencyFormatter.format(cents / 100);
}

export function parseCurrencyToCents(input: string): number | null {
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

  return Math.round(parsed * 100);
}

export function parseIntegerInput(input: string): number | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

export function formatInteger(value: number | null): string {
  if (value === null) {
    return '';
  }

  return String(value);
}
