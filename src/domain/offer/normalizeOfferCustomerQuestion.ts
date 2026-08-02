import { generateId, nowIso } from '../../utils/id';
import type { OfferCustomerQuestion, OfferCustomerQuestionStatus } from './offerCustomerQuestion';
import { OFFER_CUSTOMER_QUESTION_STATUS_LABELS } from './offerCustomerQuestion';

const STATUSES = Object.keys(OFFER_CUSTOMER_QUESTION_STATUS_LABELS) as OfferCustomerQuestionStatus[];
const nullable = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function normalizeOfferCustomerQuestion(value: unknown): OfferCustomerQuestion | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const timestamp = nowIso();
  const status = STATUSES.includes(raw.status as OfferCustomerQuestionStatus)
    ? (raw.status as OfferCustomerQuestionStatus)
    : 'open';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId('offer_question'),
    offerId: text(raw.offerId),
    offerVersionId: text(raw.offerVersionId),
    shareId: nullable(raw.shareId),
    questionText: text(raw.questionText),
    customerName: nullable(raw.customerName),
    customerEmail: nullable(raw.customerEmail),
    status,
    answerText: nullable(raw.answerText),
    answeredByUserId: nullable(raw.answeredByUserId),
    askedAt: text(raw.askedAt) || timestamp,
    answeredAt: nullable(raw.answeredAt),
    createdAt: text(raw.createdAt) || timestamp,
    updatedAt: text(raw.updatedAt) || text(raw.createdAt) || timestamp,
  };
}

export function normalizeOfferCustomerQuestions(values: unknown[]): OfferCustomerQuestion[] {
  return values
    .map(normalizeOfferCustomerQuestion)
    .filter((entry): entry is OfferCustomerQuestion => entry !== null);
}
