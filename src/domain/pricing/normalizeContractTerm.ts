import { generateId, nowIso } from '../../utils/id';
import type { ContractTerm, ContractTermStatus } from './contractTerm';

const VALID_STATUSES = new Set<ContractTermStatus>(['active', 'inactive']);

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

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeContractTerm(value: unknown): ContractTerm {
  const record = asRecord(value);
  const timestamp = nowIso();
  const status = VALID_STATUSES.has(record.status as ContractTermStatus)
    ? (record.status as ContractTermStatus)
    : 'inactive';

  return {
    id: asString(record.id) || generateId('contract_term'),
    contractTypeId: asNullableString(record.contractTypeId),
    name: asString(record.name) || `${asPositiveInteger(record.months)} Monate`,
    months: asPositiveInteger(record.months),
    isStandard: asBoolean(record.isStandard, false),
    status,
    validFrom: asNullableString(record.validFrom),
    validUntil: asNullableString(record.validUntil),
    createdAt: asString(record.createdAt) || timestamp,
    updatedAt: asString(record.updatedAt) || timestamp,
  };
}

export function normalizeContractTerms(values: unknown[]): ContractTerm[] {
  return values.map((value) => normalizeContractTerm(value));
}
