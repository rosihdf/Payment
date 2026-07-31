import { generateId, nowIso } from '../../utils/id';
import type { OfferWorkflowEvent } from './offerWorkflowEvents';

const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value.trim() : fallback;
const nullable = (value: unknown): string | null => text(value) || null;

export function normalizeOfferWorkflowEvent(value: unknown): OfferWorkflowEvent | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  if (!['approval', 'dispatch', 'acceptance', 'decline', 'activation'].includes(String(type))) return null;
  const base = {
    id: text(raw.id) || generateId('offer_workflow_event'),
    schemaVersion: Number(raw.schemaVersion) || 1,
    offerId: text(raw.offerId),
    offerVersionId: nullable(raw.offerVersionId),
    createdAt: text(raw.createdAt) || nowIso(),
    createdByUserId: text(raw.createdByUserId),
    createdByDisplayName: text(raw.createdByDisplayName),
    note: text(raw.note),
  };
  switch (type) {
    case 'approval':
      return { ...base, type, status: ['submitted', 'started', 'changes_requested', 'approved'].includes(text(raw.status)) ? text(raw.status) as 'submitted' | 'started' | 'changes_requested' | 'approved' : 'submitted', requestedByUserId: text(raw.requestedByUserId), approvedByUserId: nullable(raw.approvedByUserId) };
    case 'dispatch':
      return { ...base, type, channel: ['email', 'portal', 'manual'].includes(text(raw.channel)) ? text(raw.channel) as 'email' | 'portal' | 'manual' : 'manual', recipient: text(raw.recipient), sentAt: text(raw.sentAt) || base.createdAt };
    case 'acceptance':
      return { ...base, type, acceptedAt: text(raw.acceptedAt) || base.createdAt, acceptedByName: text(raw.acceptedByName), acceptanceType: ['signed_offer', 'email_confirmation', 'personal_confirmation', 'digital_confirmation', 'other'].includes(text(raw.acceptanceType)) ? text(raw.acceptanceType) as 'signed_offer' | 'email_confirmation' | 'personal_confirmation' | 'digital_confirmation' | 'other' : 'other', otherText: nullable(raw.otherText) };
    case 'decline':
      return { ...base, type, declinedAt: text(raw.declinedAt) || base.createdAt, reason: ['price', 'competitor', 'contract_term', 'hardware', 'no_need', 'no_response', 'postponed', 'other'].includes(text(raw.reason)) ? text(raw.reason) as 'price' | 'competitor' | 'contract_term' | 'hardware' | 'no_need' | 'no_response' | 'postponed' | 'other' : 'other', otherText: nullable(raw.otherText) };
    case 'activation':
      return { ...base, type, status: raw.status === 'activated' ? 'activated' : 'prepared', checklist: { offerVersionId: text((raw.checklist as Record<string, unknown> | undefined)?.offerVersionId) || base.offerVersionId || '', checks: raw.checklist && typeof raw.checklist === 'object' ? Object.fromEntries(Object.entries(((raw.checklist as Record<string, unknown>).checks ?? raw.checklist) as Record<string, unknown>).filter(([key]) => key !== 'offerVersionId').map(([key, entry]) => [key, entry === true])) : {} }, activatedAt: nullable(raw.activatedAt), externalReference: nullable(raw.externalReference), deviations: Array.isArray(raw.deviations) ? raw.deviations.filter((entry): entry is { field: string; expected: string; actual: string; reason: string } => Boolean(entry && typeof entry === 'object')) : [], activatedHardware: Array.isArray(raw.activatedHardware) ? raw.activatedHardware.filter((entry): entry is string => typeof entry === 'string') : [] };
    default:
      return null;
  }
}

export function normalizeOfferWorkflowEvents(values: unknown[]): OfferWorkflowEvent[] {
  return values.map(normalizeOfferWorkflowEvent).filter((value): value is OfferWorkflowEvent => value !== null);
}
