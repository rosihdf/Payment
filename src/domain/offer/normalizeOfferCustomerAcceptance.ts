import { generateId, nowIso } from '../../utils/id';
import type { OfferCustomerAcceptance, OfferCustomerAcceptanceCheckboxes } from './offerCustomerAcceptance';

const nullable = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function normalizeCheckboxes(value: unknown): OfferCustomerAcceptanceCheckboxes {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    offerReviewed: raw.offerReviewed === true,
    termsUnderstood: raw.termsUnderstood === true,
    acceptanceIntended: raw.acceptanceIntended === true,
  };
}

export function normalizeOfferCustomerAcceptance(value: unknown): OfferCustomerAcceptance | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const timestamp = nowIso();

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId('offer_acceptance'),
    offerId: text(raw.offerId),
    offerVersionId: text(raw.offerVersionId),
    acceptorName: text(raw.acceptorName),
    acceptedAt: text(raw.acceptedAt) || timestamp,
    ipAddress: nullable(raw.ipAddress),
    userAgent: nullable(raw.userAgent),
    checkboxes: normalizeCheckboxes(raw.checkboxes),
    comment: text(raw.comment),
    shareId: nullable(raw.shareId),
    createdAt: text(raw.createdAt) || timestamp,
  };
}

export function normalizeOfferCustomerAcceptances(values: unknown[]): OfferCustomerAcceptance[] {
  return values
    .map(normalizeOfferCustomerAcceptance)
    .filter((entry): entry is OfferCustomerAcceptance => entry !== null);
}
