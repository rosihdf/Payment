import { formatCentsToCurrency } from './currency';

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate));
}

export function formatDateTime(isoDate: string): string {
  return dateTimeFormatter.format(new Date(isoDate));
}

export function formatCount(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function displayText(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : 'Nicht angegeben';
}

export function displayCents(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'Nicht angegeben';
  }

  return formatCentsToCurrency(value);
}

export function displayInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'Nicht angegeben';
  }

  return String(value);
}

export function displayDateTime(value: string | null | undefined): string {
  if (!value?.trim()) {
    return 'Nicht angegeben';
  }

  return formatDateTime(value);
}

export function formatContactName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
