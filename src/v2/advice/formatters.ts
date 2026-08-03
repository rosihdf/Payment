export function formatEuro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function centsToInput(cents: number | null): string {
  if (cents === null) {
    return '';
  }
  return String(cents / 100).replace('.', ',');
}

export function parseEuroToCents(value: string): number | null {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100);
}

export function parseOptionalInt(value: string, fallback: number | null): number | null {
  if (value.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
