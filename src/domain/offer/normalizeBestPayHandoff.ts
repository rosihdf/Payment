import { generateId, nowIso } from '../../utils/id';
import type { BestPayHandoff, BestPayHandoffStatus } from './bestPayHandoff';
import { BESTPAY_HANDOFF_STATUS_LABELS } from './bestPayHandoff';

const STATUSES = Object.keys(BESTPAY_HANDOFF_STATUS_LABELS) as BestPayHandoffStatus[];

const nullable = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function normalizeBestPayHandoff(value: unknown): BestPayHandoff | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const timestamp = nowIso();
  const status = STATUSES.includes(raw.status as BestPayHandoffStatus)
    ? (raw.status as BestPayHandoffStatus)
    : 'handed_over';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId('bestpay_handoff'),
    offerId: text(raw.offerId),
    offerVersionId: text(raw.offerVersionId),
    acceptanceId: nullable(raw.acceptanceId),
    bestPayReference: nullable(raw.bestPayReference),
    status,
    note: text(raw.note),
    createdAt: text(raw.createdAt) || timestamp,
    createdByUserId: text(raw.createdByUserId),
    updatedAt: text(raw.updatedAt) || text(raw.createdAt) || timestamp,
  };
}

export function normalizeBestPayHandoffs(values: unknown[]): BestPayHandoff[] {
  return values.map(normalizeBestPayHandoff).filter((entry): entry is BestPayHandoff => entry !== null);
}
