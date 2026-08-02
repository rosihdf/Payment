export type OfferCustomerQuestionStatus = 'open' | 'answered' | 'closed';

export const OFFER_CUSTOMER_QUESTION_STATUS_LABELS: Record<OfferCustomerQuestionStatus, string> = {
  open: 'Offen',
  answered: 'Beantwortet',
  closed: 'Geschlossen',
};

export interface OfferCustomerQuestion {
  id: string;
  offerId: string;
  offerVersionId: string;
  shareId: string | null;
  questionText: string;
  customerName: string | null;
  customerEmail: string | null;
  status: OfferCustomerQuestionStatus;
  answerText: string | null;
  answeredByUserId: string | null;
  askedAt: string;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MAX_CUSTOMER_QUESTION_LENGTH = 4000;

export function sanitizeCustomerText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}
