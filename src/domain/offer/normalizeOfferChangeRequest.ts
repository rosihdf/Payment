import { generateId, nowIso } from '../../utils/id';
import type { OfferChangeRequest, OfferChangeRequestStatus } from './offerChangeRequest';
import { OFFER_CHANGE_REQUEST_STATUS_LABELS } from './offerChangeRequest';

const STATUSES = Object.keys(OFFER_CHANGE_REQUEST_STATUS_LABELS) as OfferChangeRequestStatus[];
const nullable = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function normalizeOfferChangeRequest(value: unknown): OfferChangeRequest | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const timestamp = nowIso();
  const status = STATUSES.includes(raw.status as OfferChangeRequestStatus)
    ? (raw.status as OfferChangeRequestStatus)
    : 'open';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId('offer_change'),
    offerId: text(raw.offerId),
    offerVersionId: text(raw.offerVersionId),
    shareId: nullable(raw.shareId),
    requestText: text(raw.requestText),
    customerName: nullable(raw.customerName),
    customerEmail: nullable(raw.customerEmail),
    status,
    handledByUserId: nullable(raw.handledByUserId),
    handledAt: nullable(raw.handledAt),
    createdAt: text(raw.createdAt) || timestamp,
    updatedAt: text(raw.updatedAt) || text(raw.createdAt) || timestamp,
  };
}

export function normalizeOfferChangeRequests(values: unknown[]): OfferChangeRequest[] {
  return values
    .map(normalizeOfferChangeRequest)
    .filter((entry): entry is OfferChangeRequest => entry !== null);
}
