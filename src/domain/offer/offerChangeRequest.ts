export type OfferChangeRequestStatus = 'open' | 'reviewed' | 'answered' | 'completed';

export const OFFER_CHANGE_REQUEST_STATUS_LABELS: Record<OfferChangeRequestStatus, string> = {
  open: 'Offen',
  reviewed: 'Geprüft',
  answered: 'Beantwortet',
  completed: 'Erledigt',
};

export interface OfferChangeRequest {
  id: string;
  offerId: string;
  offerVersionId: string;
  shareId: string | null;
  requestText: string;
  customerName: string | null;
  customerEmail: string | null;
  status: OfferChangeRequestStatus;
  handledByUserId: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MAX_CHANGE_REQUEST_LENGTH = 4000;
