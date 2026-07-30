import { generateId, nowIso } from '../../utils/id';
import type { PriceRule, PriceRuleStatus, PriceRuleUnit } from './priceRule';

const VALID_STATUSES = new Set<PriceRuleStatus>(['active', 'inactive']);
const VALID_UNITS = new Set<PriceRuleUnit>([
  'one_time',
  'monthly',
  'per_transaction',
  'per_unit',
  'percent_volume',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asNonNegativeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asPriority(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return 0;
  }

  return parsed;
}

export function normalizePriceRule(value: unknown): PriceRule {
  const record = asRecord(value);
  const timestamp = nowIso();
  const status = VALID_STATUSES.has(record.status as PriceRuleStatus)
    ? (record.status as PriceRuleStatus)
    : 'inactive';
  const unit = VALID_UNITS.has(record.unit as PriceRuleUnit)
    ? (record.unit as PriceRuleUnit)
    : 'monthly';

  return {
    id: asString(record.id) || generateId('price_rule'),
    priceBookVersionId: asString(record.priceBookVersionId),
    name: asString(record.name) || 'Preisregel',
    status,
    contractTypeId: asNullableString(record.contractTypeId),
    productId: asNullableString(record.productId),
    tariffId: asNullableString(record.tariffId),
    contractTermId: asNullableString(record.contractTermId),
    industryId: asNullableString(record.industryId),
    priority: asPriority(record.priority),
    combinable: asBoolean(record.combinable, false),
    listPriceCents: asNonNegativeInteger(record.listPriceCents),
    targetPriceCents: asNonNegativeInteger(record.targetPriceCents),
    minimumPriceCents: asNonNegativeInteger(record.minimumPriceCents),
    maxDiscountPercentTenths: asNonNegativeInteger(record.maxDiscountPercentTenths),
    unit,
    currency: asString(record.currency) || 'EUR',
    validFrom: asNullableString(record.validFrom),
    validUntil: asNullableString(record.validUntil),
    createdAt: asString(record.createdAt) || timestamp,
    updatedAt: asString(record.updatedAt) || timestamp,
  };
}

export function normalizePriceRules(values: unknown[]): PriceRule[] {
  return values.map((value) => normalizePriceRule(value));
}
