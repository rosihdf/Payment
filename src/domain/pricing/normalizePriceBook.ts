import { generateId, nowIso } from '../../utils/id';
import type { PriceBook, PriceBookVersion, PriceBookVersionStatus } from './priceBook';

const VALID_VERSION_STATUSES = new Set<PriceBookVersionStatus>(['draft', 'published', 'archived']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asPositiveInteger(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asDateString(value: unknown, fallback: string): string {
  const text = asString(value);
  if (!text) {
    return fallback;
  }

  return text.slice(0, 10);
}

export function normalizePriceBook(value: unknown): PriceBook {
  const record = asRecord(value);
  const timestamp = nowIso();

  return {
    id: asString(record.id) || generateId('price_book'),
    code: asString(record.code) || 'bestpay',
    name: asString(record.name) || 'BestPay Preisliste',
    createdAt: asString(record.createdAt) || timestamp,
    updatedAt: asString(record.updatedAt) || timestamp,
  };
}

export function normalizePriceBookVersion(value: unknown): PriceBookVersion {
  const record = asRecord(value);
  const timestamp = nowIso();
  const status = VALID_VERSION_STATUSES.has(record.status as PriceBookVersionStatus)
    ? (record.status as PriceBookVersionStatus)
    : 'draft';

  return {
    id: asString(record.id) || generateId('price_book_version'),
    priceBookId: asString(record.priceBookId),
    versionNumber: asPositiveInteger(record.versionNumber, 1),
    status,
    validFrom: asDateString(record.validFrom, timestamp.slice(0, 10)),
    validUntil: asNullableString(record.validUntil),
    publishedAt: asNullableString(record.publishedAt),
    createdAt: asString(record.createdAt) || timestamp,
    updatedAt: asString(record.updatedAt) || timestamp,
  };
}

export function normalizePriceBooks(values: unknown[]): PriceBook[] {
  return values.map((value) => normalizePriceBook(value));
}

export function normalizePriceBookVersions(values: unknown[]): PriceBookVersion[] {
  return values.map((value) => normalizePriceBookVersion(value));
}
