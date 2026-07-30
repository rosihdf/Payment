import { generateId, nowIso } from '../../utils/id';
import { DEFAULT_CARD_MIX, DEFAULT_PAYMENT_USAGE } from './defaults';
import type {
  CardMix,
  Lead,
  LeadInterest,
  LeadStatus,
  PaymentUsage,
  SyncState,
} from './lead';

const LEGACY_STATUS_MAP: Record<string, LeadStatus> = {
  new: 'new',
  in_progress: 'in_progress',
  contacted: 'contacted',
  qualified: 'offer',
  offer: 'offer',
  won: 'won',
  lost: 'lost',
};

const DEMO_LEAD_ASSIGNMENTS: Record<string, string> = {
  lead_001: 'user_001',
  lead_002: 'user_002',
  lead_003: 'user_003',
  lead_004: 'user_001',
  lead_005: 'user_002',
  lead_006: 'user_003',
  lead_007: 'user_003',
  lead_008: 'user_001',
};

const VALID_INTERESTS = new Set<LeadInterest>(['low', 'medium', 'high']);
const VALID_SYNC_STATES = new Set<SyncState>(['local', 'pending', 'synced', 'error']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function asNullableCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function normalizeStatus(value: unknown): LeadStatus {
  const raw = asString(value);
  return LEGACY_STATUS_MAP[raw] ?? 'new';
}

function normalizeInterest(value: unknown): LeadInterest {
  const raw = asString(value) as LeadInterest;
  return VALID_INTERESTS.has(raw) ? raw : 'medium';
}

function normalizeSyncState(value: unknown): SyncState {
  const raw = asString(value) as SyncState;
  return VALID_SYNC_STATES.has(raw) ? raw : 'pending';
}

function normalizePaymentUsage(value: unknown): PaymentUsage {
  const data = asRecord(value);

  return {
    stationary: Boolean(data.stationary),
    mobile: Boolean(data.mobile),
    ecommerce: Boolean(data.ecommerce),
    softPos: Boolean(data.softPos),
  };
}

function normalizeCardMix(value: unknown): CardMix {
  const data = asRecord(value);

  return {
    girocardPercent: Number(data.girocardPercent ?? 0),
    debitPercent: Number(data.debitPercent ?? 0),
    creditPercent: Number(data.creditPercent ?? 0),
    otherPercent: Number(data.otherPercent ?? 0),
  };
}

function splitLegacyContact(contact: string): { firstName: string; lastName: string } {
  const parts = contact.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

export function normalizeLead(raw: unknown): Lead {
  const data = asRecord(raw);
  const id = asString(data.id) || generateId('lead');

  let contactFirstName = asString(data.contactFirstName);
  let contactLastName = asString(data.contactLastName);

  if (!contactFirstName && !contactLastName) {
    const legacyContact = splitLegacyContact(asString(data.contact));
    contactFirstName = legacyContact.firstName;
    contactLastName = legacyContact.lastName;
  }

  const assignedSalesUserId =
    asString(data.assignedSalesUserId) || DEMO_LEAD_ASSIGNMENTS[id] || 'user_001';
  const createdByUserId = asString(data.createdByUserId) || assignedSalesUserId;

  return {
    id,
    companyName: asString(data.companyName) || asString(data.company),
    contactFirstName,
    contactLastName,
    phone: asString(data.phone),
    email: asString(data.email),
    street: asString(data.street),
    postalCode: asString(data.postalCode),
    city: asString(data.city),
    industry: asString(data.industry),
    currentProvider: asString(data.currentProvider),
    monthlyCardTurnoverCents: asNullableCents(data.monthlyCardTurnoverCents),
    monthlyTransactions: asNullableInteger(data.monthlyTransactions),
    averageTransactionValueCents: asNullableCents(data.averageTransactionValueCents),
    currentTerminalCount: asNullableInteger(data.currentTerminalCount),
    currentTerminalModels: asString(data.currentTerminalModels),
    paymentUsage: data.paymentUsage ? normalizePaymentUsage(data.paymentUsage) : { ...DEFAULT_PAYMENT_USAGE },
    cardMix: data.cardMix ? normalizeCardMix(data.cardMix) : { ...DEFAULT_CARD_MIX },
    currentContractEndDate: asString(data.currentContractEndDate) || null,
    currentNoticePeriod: asString(data.currentNoticePeriod),
    requiredTerminalCount: Math.max(1, asNullableInteger(data.requiredTerminalCount) ?? 1),
    status: normalizeStatus(data.status),
    interest: normalizeInterest(data.interest),
    notes: asString(data.notes),
    nextFollowUpAt: asString(data.nextFollowUpAt) || null,
    assignedSalesUserId,
    createdByUserId,
    syncState: normalizeSyncState(data.syncState),
    createdAt: asString(data.createdAt) || nowIso(),
    updatedAt: asString(data.updatedAt) || nowIso(),
  };
}

export function normalizeLeads(rawLeads: unknown[]): Lead[] {
  return rawLeads.map((lead) => normalizeLead(lead));
}
