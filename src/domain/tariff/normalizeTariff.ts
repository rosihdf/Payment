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

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

function normalizeCardRate(value: unknown): CardRate {
  const data = asRecord(value);

  const percentageTenthsOfBasisPoint =
    data.percentageTenthsOfBasisPoint !== undefined &&
    data.percentageTenthsOfBasisPoint !== null &&
    data.percentageTenthsOfBasisPoint !== ''
      ? asNonNegativeInteger(data.percentageTenthsOfBasisPoint)
      : asNonNegativeInteger(data.percentageBasisPoints) * 10;

  const fixedFeeTenthsOfCent =
    data.fixedFeeTenthsOfCent !== undefined &&
    data.fixedFeeTenthsOfCent !== null &&
    data.fixedFeeTenthsOfCent !== ''
      ? asNonNegativeInteger(data.fixedFeeTenthsOfCent)
      : asNonNegativeInteger(data.fixedFeeCents) * 10;

  return {
    percentageTenthsOfBasisPoint,
    fixedFeeTenthsOfCent,
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

function normalizeMonthlyAccountBaseFeeCents(data: Record<string, unknown>): number {
  if (data.monthlyAccountBaseFeeCents !== undefined) {
    return asNonNegativeInteger(data.monthlyAccountBaseFeeCents);
  }

  return asNonNegativeInteger(data.monthlyBaseFeeCents);
}

function normalizeMonthlyTerminalRentalCents(data: Record<string, unknown>): number {
  if (data.monthlyTerminalRentalCents !== undefined) {
    return asNonNegativeInteger(data.monthlyTerminalRentalCents);
  }

  return asNonNegativeInteger(data.monthlyTerminalFeeCents);
}

function normalizeMonthlyServiceFeePerTerminalCents(data: Record<string, unknown>): number {
  return asNonNegativeInteger(data.monthlyServiceFeePerTerminalCents);
}

function normalizeAdditionalTransactionFeeTenthsOfCent(data: Record<string, unknown>): number {
  if (
    data.additionalTransactionFeeTenthsOfCent !== undefined &&
    data.additionalTransactionFeeTenthsOfCent !== null &&
    data.additionalTransactionFeeTenthsOfCent !== ''
  ) {
    return asNonNegativeInteger(data.additionalTransactionFeeTenthsOfCent);
  }

  return asNonNegativeInteger(data.additionalTransactionFeeCents) * 10;
}

function normalizeGirocardClearingIncluded(data: Record<string, unknown>): boolean {
  return asBoolean(data.girocardClearingIncluded);
}

function normalizeGirocardClearingFeeTenthsOfCent(
  data: Record<string, unknown>,
  clearingIncluded: boolean,
): number {
  if (clearingIncluded) {
    return 0;
  }

  if (
    data.girocardClearingFeeTenthsOfCent !== undefined &&
    data.girocardClearingFeeTenthsOfCent !== null &&
    data.girocardClearingFeeTenthsOfCent !== ''
  ) {
    return asNonNegativeInteger(data.girocardClearingFeeTenthsOfCent);
  }

  if (data.girocardClearingFeeCents !== undefined) {
    return asNonNegativeInteger(data.girocardClearingFeeCents) * 10;
  }

  return 0;
}

export function normalizeTariff(raw: unknown): Tariff {
  const data = asRecord(raw);
  const id = asString(data.id) || generateId('tariff');
  const timestamp = nowIso();
  const cardRates = data.cardRates ? normalizeCardRates(data.cardRates) : { ...DEFAULT_CARD_RATES };
  const girocardClearingIncluded = normalizeGirocardClearingIncluded(data);

  return {
    id,
    name: asString(data.name),
    providerName: asString(data.providerName) || 'BestPay',
    productCode: asString(data.productCode),
    description: asString(data.description),
    status: normalizeLegacyActiveField(data),
    supportedTerminalTypes: normalizeTerminalTypes(data.supportedTerminalTypes),
    monthlyAccountBaseFeeCents: normalizeMonthlyAccountBaseFeeCents(data),
    monthlyTerminalRentalCents: normalizeMonthlyTerminalRentalCents(data),
    monthlyServiceFeePerTerminalCents: normalizeMonthlyServiceFeePerTerminalCents(data),
    setupFeeCents: asNonNegativeInteger(data.setupFeeCents),
    minimumMonthlyFeeCents: asNullableNonNegativeInteger(data.minimumMonthlyFeeCents),
    minimumContractMonths: asNullableNonNegativeInteger(data.minimumContractMonths),
    noticePeriodMonths: asNullableNonNegativeInteger(data.noticePeriodMonths),
    includedTransactions: asNullableNonNegativeInteger(data.includedTransactions),
    additionalTransactionFeeTenthsOfCent: normalizeAdditionalTransactionFeeTenthsOfCent(data),
    girocardClearingFeeTenthsOfCent: normalizeGirocardClearingFeeTenthsOfCent(
      data,
      girocardClearingIncluded,
    ),
    girocardClearingIncluded,
    cardRates,
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
