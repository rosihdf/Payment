import { generateId, nowIso } from '../../utils/id';
import {
  normalizeCustomerSnapshot,
  normalizeOfferItem,
  normalizeTariffSnapshot,
} from '../offer/normalizeOffer';
import type { OfferItem, OfferTotals } from '../offer/offer';
import { CONTRACT_STATUSES, type ContractStatus } from './contractStatus';
import type { Contract } from './contract';
import { CURRENT_CONTRACT_SCHEMA_VERSION } from './contract';
import {
  CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
  type ContractChangeReason,
  type ContractFeeSnapshot,
  type ContractHardwareLine,
  type ContractVersion,
  type ContractVersionSnapshot,
  type ContractVersionStatus,
} from './contractVersion';
import { CURRENT_CONTRACT_TERMINATION_SCHEMA_VERSION } from './contractTermination';
import type {
  ContractTermination,
  ContractTerminationChannel,
  ContractTerminationParty,
  ContractTerminationReason,
  ContractTerminationStatus,
  WinbackStatus,
} from './contractTermination';

const CONTRACT_VERSION_STATUSES: ContractVersionStatus[] = [
  'draft', 'planned', 'active', 'expired', 'discarded',
];
const CONTRACT_CHANGE_REASONS: ContractChangeReason[] = [
  'initial', 'tariff_change', 'term_extension', 'terminal_add', 'terminal_remove',
  'terminal_model_change', 'accessory_add', 'accessory_remove', 'fee_change',
  'contact_change', 'address_change', 'contract_model_change', 'renewal', 'other_amendment',
];
const CONTRACT_TERMINATION_REASONS: ContractTerminationReason[] = [
  'price', 'competitor', 'service', 'hardware', 'business_closure',
  'provider_switch', 'no_usage', 'contract_change', 'other',
];
const CONTRACT_TERMINATION_STATUSES: ContractTerminationStatus[] = [
  'recorded', 'review_required', 'winback', 'confirmed', 'withdrawn', 'completed', 'rejected',
];
const CONTRACT_TERMINATION_CHANNELS: ContractTerminationChannel[] = [
  'email', 'phone', 'letter', 'portal', 'in_person', 'other',
];
const CONTRACT_TERMINATION_PARTIES: ContractTerminationParty[] = ['customer', 'internal'];
const WINBACK_STATUSES: WinbackStatus[] = ['none', 'open', 'won', 'lost'];
const HARDWARE_MOBILITY = ['stationary', 'mobile', 'unknown'] as const;
const HARDWARE_ACQUISITION = ['purchase', 'rental', 'unknown'] as const;
const HARDWARE_ACTIVATION_STATUS = ['pending', 'active', 'returned', 'unknown'] as const;

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value.trim() : fallback);
const nullable = (value: unknown): string | null => (text(value) ? text(value) : null);
const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const asNonNegativeInteger = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};
const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const asItemArray = (value: unknown): OfferItem[] =>
  Array.isArray(value) ? value.map((entry, index) => normalizeOfferItem(entry, index)) : [];

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function normalizeHardwareLine(value: unknown): ContractHardwareLine | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  return {
    productId: nullable(raw.productId),
    productName: text(raw.productName),
    model: text(raw.model),
    quantity: asNonNegativeInteger(raw.quantity, 1),
    mobility: asEnum(raw.mobility, HARDWARE_MOBILITY, 'unknown'),
    acquisition: asEnum(raw.acquisition, HARDWARE_ACQUISITION, 'unknown'),
    activationStatus: asEnum(raw.activationStatus, HARDWARE_ACTIVATION_STATUS, 'pending'),
    serialNumber: nullable(raw.serialNumber),
    validFrom: nullable(raw.validFrom),
    validTo: nullable(raw.validTo),
    unitPriceCents: asNumber(raw.unitPriceCents),
  };
}

function normalizeHardwareLines(value: unknown): ContractHardwareLine[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(normalizeHardwareLine)
    .filter((entry): entry is ContractHardwareLine => entry !== null);
}

function normalizeFeeSnapshot(value: unknown): ContractFeeSnapshot {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    monthlyFeeCents: asNumber(raw.monthlyFeeCents),
    setupFeeCents: asNumber(raw.setupFeeCents),
    transactionFeeNote: nullable(raw.transactionFeeNote),
    clearingNote: nullable(raw.clearingNote),
    discountNote: nullable(raw.discountNote),
  };
}

function normalizeContractTotals(value: unknown): OfferTotals {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    monthlyItemsTotalCents: asNonNegativeInteger(raw.monthlyItemsTotalCents),
    oneTimeItemsTotalCents: asNonNegativeInteger(raw.oneTimeItemsTotalCents),
    tariffMonthlyFixedTotalCents: asNonNegativeInteger(raw.tariffMonthlyFixedTotalCents),
    tariffSetupTotalCents: asNonNegativeInteger(raw.tariffSetupTotalCents),
    monthlyTotalCents: asNonNegativeInteger(raw.monthlyTotalCents),
    oneTimeTotalCents: asNonNegativeInteger(raw.oneTimeTotalCents),
    hasOnRequestItems: asBoolean(raw.hasOnRequestItems),
    onRequestItemCount: asNonNegativeInteger(raw.onRequestItemCount),
  };
}

function normalizeContractVersionSnapshot(value: unknown): ContractVersionSnapshot {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    schemaVersion: asNonNegativeInteger(raw.schemaVersion, CURRENT_CONTRACT_VERSION_SCHEMA_VERSION) || CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
    customerSnapshot: normalizeCustomerSnapshot(raw.customerSnapshot),
    tariffSnapshot: normalizeTariffSnapshot(raw.tariffSnapshot),
    contractModel: text(raw.contractModel, 'not_specified') as ContractVersionSnapshot['contractModel'],
    termMonths: asNumber(raw.termMonths),
    startDate: nullable(raw.startDate),
    endDate: nullable(raw.endDate),
    noticePeriodMonths: asNumber(raw.noticePeriodMonths),
    autoRenewal: asBoolean(raw.autoRenewal),
    renewalMonths: asNumber(raw.renewalMonths),
    terminalCount: asNonNegativeInteger(raw.terminalCount),
    terminalLines: asItemArray(raw.terminalLines),
    accessoryLines: asItemArray(raw.accessoryLines),
    hardware: normalizeHardwareLines(raw.hardware),
    fees: normalizeFeeSnapshot(raw.fees),
    optionalItems: asItemArray(raw.optionalItems),
    totals: normalizeContractTotals(raw.totals),
    priceBookVersion: nullable(raw.priceBookVersion),
    commissionReferenceId: nullable(raw.commissionReferenceId),
    expectedCommissionCents: asNumber(raw.expectedCommissionCents),
    sourceOfferId: nullable(raw.sourceOfferId),
    sourceOfferVersionId: nullable(raw.sourceOfferVersionId),
    sourceOfferNumber: nullable(raw.sourceOfferNumber),
    activationNote: nullable(raw.activationNote),
  };
}

export function normalizeContract(value: unknown): Contract | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = text(raw.id);
  const contractNumber = text(raw.contractNumber);
  if (!id || !contractNumber) {
    return null;
  }
  const timestamp = nowIso();
  const status = asEnum<ContractStatus>(raw.status, CONTRACT_STATUSES, 'preparation');

  return {
    id,
    schemaVersion: asNonNegativeInteger(raw.schemaVersion, CURRENT_CONTRACT_SCHEMA_VERSION) || CURRENT_CONTRACT_SCHEMA_VERSION,
    contractNumber,
    sourceKey: text(raw.sourceKey) || `contract:${id}`,
    leadId: nullable(raw.leadId),
    sourceOfferId: nullable(raw.sourceOfferId),
    acceptedOfferVersionId: nullable(raw.acceptedOfferVersionId),
    currentVersionId: nullable(raw.currentVersionId),
    status,
    ownerUserId: text(raw.ownerUserId),
    startDate: nullable(raw.startDate),
    termMonths: asNumber(raw.termMonths),
    endDate: nullable(raw.endDate),
    noticePeriodMonths: asNumber(raw.noticePeriodMonths),
    earliestTerminationDate: nullable(raw.earliestTerminationDate),
    autoRenewal: asBoolean(raw.autoRenewal),
    renewalMonths: asNumber(raw.renewalMonths),
    activationOfferId: nullable(raw.activationOfferId),
    commissionCaseId: nullable(raw.commissionCaseId),
    expectedCommissionCents: asNumber(raw.expectedCommissionCents),
    hardwareCount: asNonNegativeInteger(raw.hardwareCount),
    tariffName: nullable(raw.tariffName),
    customerCompanyName: text(raw.customerCompanyName),
    nextDeadlineAt: nullable(raw.nextDeadlineAt),
    nextDeadlineLabel: nullable(raw.nextDeadlineLabel),
    plannedChangeAt: nullable(raw.plannedChangeAt),
    terminationId: nullable(raw.terminationId),
    createdAt: text(raw.createdAt) || timestamp,
    createdByUserId: text(raw.createdByUserId),
    createdByDisplayName: text(raw.createdByDisplayName),
    updatedAt: text(raw.updatedAt) || timestamp,
    updatedByUserId: text(raw.updatedByUserId) || text(raw.createdByUserId),
  };
}

export function normalizeContracts(values: unknown[]): Contract[] {
  return values
    .map((value) => {
      try {
        return normalizeContract(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is Contract => value !== null);
}

export function normalizeContractVersion(value: unknown): ContractVersion | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = text(raw.id);
  const contractId = text(raw.contractId);
  if (!id || !contractId) {
    return null;
  }
  const timestamp = nowIso();

  return {
    id,
    schemaVersion: asNonNegativeInteger(raw.schemaVersion, CURRENT_CONTRACT_VERSION_SCHEMA_VERSION) || CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
    contractId,
    versionNumber: Math.max(1, asNonNegativeInteger(raw.versionNumber, 1)),
    status: asEnum<ContractVersionStatus>(raw.status, CONTRACT_VERSION_STATUSES, 'draft'),
    validFrom: nullable(raw.validFrom),
    validTo: nullable(raw.validTo),
    changeReason: asEnum<ContractChangeReason>(raw.changeReason, CONTRACT_CHANGE_REASONS, 'other_amendment'),
    changeNote: text(raw.changeNote),
    previousVersionId: nullable(raw.previousVersionId),
    sourceOfferVersionId: nullable(raw.sourceOfferVersionId),
    snapshot: normalizeContractVersionSnapshot(raw.snapshot),
    approvalRequired: asBoolean(raw.approvalRequired),
    approvalReasons: asStringArray(raw.approvalReasons),
    approvedAt: nullable(raw.approvedAt),
    approvedByUserId: nullable(raw.approvedByUserId),
    activatedAt: nullable(raw.activatedAt),
    discardedAt: nullable(raw.discardedAt),
    createdAt: text(raw.createdAt) || timestamp,
    createdByUserId: text(raw.createdByUserId),
    createdByDisplayName: text(raw.createdByDisplayName),
  };
}

export function normalizeContractVersions(values: unknown[]): ContractVersion[] {
  return values
    .map((value) => {
      try {
        return normalizeContractVersion(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is ContractVersion => value !== null);
}

export function normalizeContractTermination(value: unknown): ContractTermination | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = text(raw.id) || generateId('contract_termination');
  const contractId = text(raw.contractId);
  if (!contractId) {
    return null;
  }
  const timestamp = nowIso();

  return {
    id,
    schemaVersion: asNonNegativeInteger(raw.schemaVersion, CURRENT_CONTRACT_TERMINATION_SCHEMA_VERSION) || CURRENT_CONTRACT_TERMINATION_SCHEMA_VERSION,
    contractId,
    contractVersionId: nullable(raw.contractVersionId),
    status: asEnum<ContractTerminationStatus>(raw.status, CONTRACT_TERMINATION_STATUSES, 'recorded'),
    receivedAt: text(raw.receivedAt) || timestamp,
    requestedEndDate: nullable(raw.requestedEndDate),
    effectiveEndDate: nullable(raw.effectiveEndDate),
    reason: asEnum<ContractTerminationReason>(raw.reason, CONTRACT_TERMINATION_REASONS, 'other'),
    otherReasonText: nullable(raw.otherReasonText),
    channel: asEnum<ContractTerminationChannel>(raw.channel, CONTRACT_TERMINATION_CHANNELS, 'other'),
    party: asEnum<ContractTerminationParty>(raw.party, CONTRACT_TERMINATION_PARTIES, 'customer'),
    documentedByUserId: text(raw.documentedByUserId),
    documentedAt: text(raw.documentedAt) || timestamp,
    winbackPossible: asBoolean(raw.winbackPossible),
    winbackStatus: asEnum<WinbackStatus>(raw.winbackStatus, WINBACK_STATUSES, 'none'),
    confirmedAt: nullable(raw.confirmedAt),
    completedAt: nullable(raw.completedAt),
    withdrawnAt: nullable(raw.withdrawnAt),
    comment: text(raw.comment),
    evidenceDocumentId: nullable(raw.evidenceDocumentId),
    noticePeriodClear: asBoolean(raw.noticePeriodClear, true),
    reviewNote: nullable(raw.reviewNote),
  };
}

export function normalizeContractTerminations(values: unknown[]): ContractTermination[] {
  return values
    .map((value) => {
      try {
        return normalizeContractTermination(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is ContractTermination => value !== null);
}
