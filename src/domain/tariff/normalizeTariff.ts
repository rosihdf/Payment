import { generateId, nowIso } from '../../utils/id';
import { DEFAULT_CARD_RATES } from './defaults';
import type {
  BillingInterval,
  CardRate,
  Tariff,
  TariffCardRates,
  TariffStatus,
  TerminalType,
} from './tariff';

const VALID_STATUSES = new Set<TariffStatus>(['active', 'inactive']);
const VALID_TERMINAL_TYPES = new Set<TerminalType>([
  'stationary',
  'mobile',
  'softpos',
  'ecommerce',
]);
const VALID_BILLING_INTERVALS = new Set<BillingInterval>(['monthly', 'yearly', 'one_time']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function asNullableNonNegativeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function normalizeCardRate(value: unknown): CardRate {
  const data = asRecord(value);

  return {
    percentageBasisPoints: asNonNegativeInteger(data.percentageBasisPoints),
    fixedFeeCents: asNonNegativeInteger(data.fixedFeeCents),
  };
}

function normalizeCardRates(value: unknown): TariffCardRates {
  const data = asRecord(value);

  return {
    girocard: data.girocard ? normalizeCardRate(data.girocard) : { ...DEFAULT_CARD_RATES.girocard },
    debit: data.debit ? normalizeCardRate(data.debit) : { ...DEFAULT_CARD_RATES.debit },
    credit: data.credit ? normalizeCardRate(data.credit) : { ...DEFAULT_CARD_RATES.credit },
    other: data.other ? normalizeCardRate(data.other) : { ...DEFAULT_CARD_RATES.other },
  };
}

function normalizeStatus(value: unknown): TariffStatus {
  const raw = asString(value) as TariffStatus;
  if (VALID_STATUSES.has(raw)) {
    return raw;
  }

  if (value === true || value === 'true') {
    return 'active';
  }

  if (value === false || value === 'false') {
    return 'inactive';
  }

  if (typeof value === 'object' && value !== null && 'active' in (value as Record<string, unknown>)) {
    return (value as { active: boolean }).active ? 'active' : 'inactive';
  }

  return 'active';
}

function normalizeLegacyActiveField(data: Record<string, unknown>): TariffStatus {
  if ('status' in data) {
    return normalizeStatus(data.status);
  }

  if ('active' in data) {
    return data.active ? 'active' : 'inactive';
  }

  return 'active';
}

function normalizeTerminalTypes(value: unknown): TerminalType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is TerminalType =>
    VALID_TERMINAL_TYPES.has(item as TerminalType),
  );
}

function normalizeBillingInterval(value: unknown): BillingInterval {
  const raw = asString(value) as BillingInterval;
  return VALID_BILLING_INTERVALS.has(raw) ? raw : 'monthly';
}

function normalizeDate(value: unknown): string | null {
  const raw = asString(value);
  return raw || null;
}

export function normalizeTariff(raw: unknown): Tariff {
  const data = asRecord(raw);
  const id = asString(data.id) || generateId('tariff');
  const timestamp = nowIso();

  return {
    id,
    name: asString(data.name),
    providerName: asString(data.providerName) || 'BestPay',
    productCode: asString(data.productCode),
    description: asString(data.description),
    status: normalizeLegacyActiveField(data),
    supportedTerminalTypes: normalizeTerminalTypes(data.supportedTerminalTypes),
    monthlyBaseFeeCents: asNonNegativeInteger(data.monthlyBaseFeeCents),
    monthlyTerminalFeeCents: asNonNegativeInteger(data.monthlyTerminalFeeCents),
    setupFeeCents: asNonNegativeInteger(data.setupFeeCents),
    minimumMonthlyFeeCents: asNullableNonNegativeInteger(data.minimumMonthlyFeeCents),
    minimumContractMonths: asNullableNonNegativeInteger(data.minimumContractMonths),
    noticePeriodMonths: asNullableNonNegativeInteger(data.noticePeriodMonths),
    includedTransactions: asNullableNonNegativeInteger(data.includedTransactions),
    additionalTransactionFeeCents: asNonNegativeInteger(data.additionalTransactionFeeCents),
    cardRates: data.cardRates ? normalizeCardRates(data.cardRates) : { ...DEFAULT_CARD_RATES },
    billingInterval: normalizeBillingInterval(data.billingInterval),
    validFrom: normalizeDate(data.validFrom),
    validUntil: normalizeDate(data.validUntil),
    notes: asString(data.notes),
    createdAt: asString(data.createdAt) || timestamp,
    updatedAt: asString(data.updatedAt) || timestamp,
  };
}

export function normalizeTariffs(rawTariffs: unknown[]): Tariff[] {
  return rawTariffs.map((tariff) => normalizeTariff(tariff));
}
