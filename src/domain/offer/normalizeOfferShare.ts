import { generateId, nowIso } from '../../utils/id';
import type { OfferShare, ShareStatus } from './offerShare';
import { SHARE_STATUS_LABELS } from './offerShare';

const STATUSES = Object.keys(SHARE_STATUS_LABELS) as ShareStatus[];

const nullable = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
};

export function normalizeOfferShare(value: unknown): OfferShare | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const timestamp = nowIso();
  const status = STATUSES.includes(raw.status as ShareStatus)
    ? (raw.status as ShareStatus)
    : 'active';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId('offer_share'),
    offerId: text(raw.offerId),
    offerVersionId: text(raw.offerVersionId),
    tokenHash: text(raw.tokenHash),
    status,
    validFrom: text(raw.validFrom) || timestamp,
    validUntil: text(raw.validUntil) || timestamp,
    accessCount: asCount(raw.accessCount),
    lastAccessAt: nullable(raw.lastAccessAt),
    createdAt: text(raw.createdAt) || timestamp,
    createdByUserId: text(raw.createdByUserId),
    revokedAt: nullable(raw.revokedAt),
    revokedByUserId: nullable(raw.revokedByUserId),
    supersededAt: nullable(raw.supersededAt),
  };
}

export function normalizeOfferShares(values: unknown[]): OfferShare[] {
  return values.map(normalizeOfferShare).filter((entry): entry is OfferShare => entry !== null);
}
